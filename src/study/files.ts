// Reads PDFs, Word files, text and photos into plain text, entirely in the browser.
// Each reader library is loaded only when a file of that kind is opened.
import { MAX_SOURCE_PAGES, MAX_TEXT_CHARACTERS, cleanText, wordCount } from './buddy'
import type { SourcePage } from './buddy'

type Progress = (message: string, percent: number) => void
type OcrWorker = { recognize: (image: any) => Promise<{ data: { text: string; confidence: number } }>; terminate: () => Promise<unknown> }

const abortError = () => new DOMException('Reading cancelled.', 'AbortError')
const checkAbort = (signal?: AbortSignal) => {
  if (signal?.aborted) throw abortError()
}

const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'webp']
const HANDWRITING = 'Handwriting is not reliably recognised.'

export class LocalMaterialReader {
  private worker: OcrWorker | null = null
  private loadingPdf: { destroy: () => Promise<void> } | null = null

  constructor(private onProgress: Progress = () => {}) {}

  async close() {
    const worker = this.worker
    this.worker = null
    await worker?.terminate().catch(() => {})
    const task = this.loadingPdf
    this.loadingPdf = null
    await task?.destroy().catch(() => {})
  }

  private async getOCR(signal?: AbortSignal) {
    checkAbort(signal)
    if (this.worker) return this.worker
    this.onProgress('Loading the photo reader on this device…', 5)
    const { createWorker } = await import('tesseract.js')
    checkAbort(signal)
    // The OCR engine and English data come from tesseract.js's pinned CDN; the photo itself never leaves the device.
    const worker = (await createWorker('eng', 1, {
      logger: (e: { status: string; progress: number }) => {
        if (e.status === 'recognizing text') this.onProgress('Reading printed text on this device…', Math.round((e.progress || 0) * 100))
      },
    })) as unknown as OcrWorker
    if (signal?.aborted) {
      await worker.terminate()
      throw abortError()
    }
    this.worker = worker
    return worker
  }

  private async readImage(input: Blob | HTMLCanvasElement, signal?: AbortSignal) {
    const worker = await this.getOCR(signal)
    checkAbort(signal)
    let image: Blob | HTMLCanvasElement = input
    let bitmap: ImageBitmap | undefined
    try {
      if (input instanceof Blob && typeof createImageBitmap === 'function') {
        bitmap = await createImageBitmap(input)
        const scale = Math.min(1, 2200 / Math.max(bitmap.width, bitmap.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(bitmap.width * scale)
        canvas.height = Math.round(bitmap.height * scale)
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
        image = canvas
      }
      const { data } = await worker.recognize(image)
      checkAbort(signal)
      return { text: cleanText(data.text), confidence: Number(data.confidence) || 0 }
    } finally {
      bitmap?.close()
    }
  }

  private async readPDF(file: File, signal: AbortSignal | undefined, availablePages: number): Promise<SourcePage[]> {
    const [pdfjs, { default: workerSrc }] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')])
    checkAbort(signal)
    pdfjs.GlobalWorkerOptions.workerSrc = workerSrc
    const cdn = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}`
    const task = pdfjs.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
      cMapUrl: `${cdn}/cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `${cdn}/standard_fonts/`,
      useSystemFonts: true,
    })
    this.loadingPdf = task
    try {
      const pdf = await task.promise
      checkAbort(signal)
      if (pdf.numPages > availablePages) {
        throw new Error(`This PDF has ${pdf.numPages} pages. Split it into a smaller file so the pack stays within ${MAX_SOURCE_PAGES} pages.`)
      }
      const pages: SourcePage[] = []
      let photoPages = 0
      for (let n = 1; n <= pdf.numPages; n += 1) {
        checkAbort(signal)
        this.onProgress(`Reading ${file.name} · page ${n} of ${pdf.numPages}…`, Math.round((n / pdf.numPages) * 100))
        const page = await pdf.getPage(n)
        const content = await page.getTextContent()
        let text = ''
        let lastY: number | null = null
        let lastHeight = 0
        for (const item of content.items) {
          if (!('str' in item)) continue
          const y = item.transform?.[5]
          if (lastY !== null && y !== undefined && Math.abs(y - lastY) > Math.max(lastHeight * 1.8, 24)) text += '\n\n'
          text += `${item.str}${item.hasEOL ? '\n' : ' '}`
          lastY = y
          lastHeight = Math.abs(item.height || 12)
        }
        text = cleanText(text)
        let warning = ''
        if (wordCount(text) < 12) {
          // Scanned page: render it and read it as a photo, up to 5 per PDF.
          if (photoPages < 5) {
            photoPages += 1
            this.onProgress(`Reading scanned page ${n} on this device…`, 0)
            const original = page.getViewport({ scale: 1 })
            const viewport = page.getViewport({ scale: Math.min(2, 2000 / Math.max(original.width, original.height)) })
            const canvas = document.createElement('canvas')
            canvas.width = Math.ceil(viewport.width)
            canvas.height = Math.ceil(viewport.height)
            await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport }).promise
            const result = await this.readImage(canvas, signal)
            text = result.text
            warning = `Scanned page read automatically${result.confidence < 75 ? ' with low confidence' : ''}. Check the text. ${HANDWRITING}`
            canvas.width = 1
            canvas.height = 1
          } else {
            warning = 'This page has little selectable text. Automatic photo reading is limited to 5 scanned pages per PDF. Type or paste its text to include it.'
          }
        }
        if (wordCount(text) < 5) warning = `No reliable text was found. Type or paste this page’s content to include it. ${HANDWRITING}`
        pages.push({ id: crypto.randomUUID(), source: file.name, label: `Page ${n}`, text, warning })
        page.cleanup()
      }
      return pages
    } finally {
      if (this.loadingPdf === task) this.loadingPdf = null
      await task.destroy()
    }
  }

  async read(file: File, { signal, availablePages = MAX_SOURCE_PAGES }: { signal?: AbortSignal; availablePages?: number } = {}): Promise<SourcePage[]> {
    checkAbort(signal)
    if (file.size > 10 * 1024 * 1024) throw new Error('Choose files smaller than 10 MB each.')
    if (!file.size) throw new Error('This file is empty.')
    const ext = (file.name.split('.').at(-1) || '').toLowerCase()
    if (ext === 'pdf' || file.type === 'application/pdf') return this.readPDF(file, signal, availablePages)
    let text = ''
    let warning = ''
    const isImage = IMAGE_EXT.includes(ext) || /^image\/(?:jpeg|png|webp)$/.test(file.type)
    if (ext === 'docx') {
      const { default: mammoth } = await import('mammoth/mammoth.browser.min.js')
      checkAbort(signal)
      const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
      text = cleanText(result.value)
      warning = 'Word text extracted without page layout. Check tables, equations and any text inside images against the original.'
    } else if (['txt', 'md'].includes(ext) || file.type === 'text/plain') {
      text = cleanText(await file.text())
    } else if (isImage) {
      const result = await this.readImage(file, signal)
      text = result.text
      warning = `Photo read automatically${result.confidence < 75 ? ' with low confidence' : ''}. Check the text. ${HANDWRITING}`
    } else {
      throw new Error(ext === 'doc' ? 'Save older .doc files as .docx or PDF first.' : 'Use a PDF, .docx, text, JPG, PNG or WebP file.')
    }
    checkAbort(signal)
    if (text.length > MAX_TEXT_CHARACTERS) throw new Error('This file has too much text for one pack. Split it into smaller sections.')
    if (wordCount(text) < 5) warning = 'No reliable text was found. Type or paste this source’s content before creating the pack.'
    return [{ id: crypto.randomUUID(), source: file.name, label: isImage ? 'Photo' : 'Text', text, warning }]
  }
}
