import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import {
  BUDDY_STORAGE_KEY,
  EXAMPLE_NOTES,
  MAX_SOURCES,
  MAX_SOURCE_PAGES,
  MAX_TEXT_CHARACTERS,
  cleanText,
  createRevisionPack,
  normalizeSavedPacks,
  packAsText,
  wordCount,
} from '../buddy'
import type { PackLength, RevisionPack, SourcePage } from '../buddy'
import { LocalMaterialReader } from '../files'
import { useStudy } from './context'
import { Dialog, Feedback, Field, Segmented } from './primitives'
import { downloadFile, plural, storageAvailable, useStored } from './stored'
import { TabHero } from './TabHero'

type Msg = { message: string; error?: boolean }

export function BuddyTab() {
  const { study, startFocus } = useStudy()
  const [saved, setSaved] = useStored(BUDDY_STORAGE_KEY, normalizeSavedPacks, () => [] as RevisionPack[])
  const [pages, setPages] = useState<SourcePage[]>([])
  const [pack, setPack] = useState<RevisionPack | null>(null)
  const [dirty, setDirty] = useState(false)
  const [reviewed, setReviewed] = useState(false)
  const [title, setTitle] = useState('')
  const [course, setCourse] = useState('')
  const [length, setLength] = useState<PackLength>('standard')
  const [questionCount, setQuestionCount] = useState(10)
  const [panel, setPanel] = useState<'notes' | 'questions'>('notes')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState({ text: '', value: 0 })
  const [feedback, setFeedback] = useState<Msg>({ message: '' })
  const [dragging, setDragging] = useState(false)
  const [openSource, setOpenSource] = useState<string | null>(null)
  const [paste, setPaste] = useState<{ open: boolean; name: string; text: string; error: string }>({ open: false, name: '', text: '', error: '' })
  const [pending, setPending] = useState<RevisionPack | 'new' | null>(null)
  const controller = useRef<AbortController | null>(null)
  const reader = useRef<LocalMaterialReader | null>(null)
  const filesRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const packRef = useRef<HTMLElement>(null)

  useEffect(() => () => void reader.current?.close(), [])

  const courseOptions = study.courses.map((c) => `${c.code} · ${c.title}`)
  if (course && !courseOptions.includes(course)) courseOptions.unshift(course)
  const words = pages.reduce((sum, p) => sum + wordCount(p.text), 0)

  const markDirty = () => {
    setDirty(true)
    setReviewed(false)
    if (pack) setFeedback({ message: 'Your material changed. Create a new pack to update the results.' })
  }

  // Callers run checkLimits first, so this only appends.
  const addPages = (incoming: SourcePage[]) => {
    setPages((prev) => [...prev, ...incoming])
    markDirty()
    setOpenSource(incoming[0]?.id ?? null)
  }

  const checkLimits = (incoming: SourcePage[]) => {
    if (pages.length + incoming.length > MAX_SOURCE_PAGES) throw new Error(`Use up to ${MAX_SOURCE_PAGES} source pages in one pack.`)
    if ([...pages, ...incoming].reduce((sum, p) => sum + p.text.length, 0) > MAX_TEXT_CHARACTERS) {
      throw new Error('Use up to 150,000 characters in one pack. Split your material into smaller sections.')
    }
  }

  const importFiles = async (list: FileList | File[]) => {
    if (busy) return
    const files = [...list]
    if (!files.length) return
    const names = new Set(pages.map((p) => p.source))
    if (new Set([...names, ...files.map((f) => f.name)]).size > MAX_SOURCES) {
      setFeedback({ message: `Use up to ${MAX_SOURCES} files or typed note sets in one pack. Remove one first, or start another pack.`, error: true })
      return
    }
    const ctrl = new AbortController()
    controller.current = ctrl
    const local = new LocalMaterialReader((text, value) => !ctrl.signal.aborted && setProgress({ text, value }))
    reader.current = local
    setBusy(true)
    setFeedback({ message: '' })
    const errors: string[] = []
    let added = 0
    let available = MAX_SOURCE_PAGES - pages.length
    const collected: SourcePage[] = []
    try {
      for (const file of files) {
        if (ctrl.signal.aborted) break
        if (names.has(file.name)) {
          errors.push(`${file.name} is already added. Remove it before uploading a replacement.`)
          continue
        }
        setProgress({ text: `Opening ${file.name}…`, value: 0 })
        try {
          const incoming = await local.read(file, { signal: ctrl.signal, availablePages: available })
          if (ctrl.signal.aborted) break
          checkLimits([...collected, ...incoming])
          collected.push(...incoming)
          available -= incoming.length
          names.add(file.name)
          added += 1
        } catch (e) {
          const err = e as Error
          if (err.name === 'AbortError' || ctrl.signal.aborted) break
          const detail = /password/i.test(err.message || '') ? 'This PDF is password protected. Upload an unlocked copy.' : err.message || 'The file couldn’t be read.'
          errors.push(`${file.name}: ${detail}`)
        }
      }
    } finally {
      await local.close()
      reader.current = null
      controller.current = null
      if (collected.length) addPages(collected)
      setBusy(false)
      setFeedback({
        message: `${ctrl.signal.aborted ? 'Reading cancelled. ' : ''}${added ? `${plural(added, 'file')} added. Check the text below. ` : ''}${errors.join(' ')}`,
        error: errors.length > 0,
      })
    }
  }

  const loadPack = (item: RevisionPack) => {
    setPack(item)
    setPages(item.pages.map((p) => ({ ...p })))
    setDirty(false)
    setTitle(item.title)
    setCourse(item.courseLabel)
    setLength(item.length || 'standard')
    setReviewed(true)
    setPanel('notes')
    setFeedback({ message: 'Saved pack opened. Edit the material to make a new version.' })
  }

  const resetDraft = () => {
    setPages([])
    setPack(null)
    setDirty(false)
    setTitle('')
    setReviewed(false)
    setPanel('notes')
    setFeedback({ message: 'A fresh pack is ready. Add the material you want to revise.' })
  }

  const requestSwitch = (item: RevisionPack | 'new') => {
    if (busy) return
    if (dirty && pages.length) setPending(item)
    else if (item === 'new') resetDraft()
    else loadPack(item)
  }

  const create = () => {
    if (busy) return
    if (!reviewed) {
      setFeedback({ message: 'Check the extracted text and tick the box before creating a pack.', error: true })
      return
    }
    try {
      const next = createRevisionPack({ pages, title, courseLabel: course, length, questionCount })
      setPack(next)
      setPages(next.pages.map((p) => ({ ...p })))
      setDirty(false)
      setSaved((prev) => [next, ...prev.filter((p) => p.id !== next.id)].slice(0, 5))
      setPanel('notes')
      setFeedback({ message: storageAvailable() ? 'Your revision pack is ready and saved on this device.' : 'Your revision pack is ready for this visit. Download a copy to keep it.' })
      requestAnimationFrame(() => packRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    } catch (e) {
      setFeedback({ message: (e as Error).message, error: true })
    }
  }

  const print = () => {
    if (!pack) return
    document.body.classList.add('printing-pack')
    window.addEventListener('afterprint', () => document.body.classList.remove('printing-pack'), { once: true })
    window.print()
  }

  const viewSource = (pageId: string) => {
    setOpenSource(pageId)
    requestAnimationFrame(() => document.getElementById(`sd-src-${pageId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  }

  const noteGroups = pack
    ? [...pack.notes.reduce((m, n) => m.set(`${n.pageId}::${n.heading}`, [...(m.get(`${n.pageId}::${n.heading}`) || []), n]), new Map<string, typeof pack.notes>()).values()]
    : []

  return (
    <>
      <TabHero
        index="04"
        label="Study Buddy"
        title={['Your notes,', 'ready to revise.']}
        intro="Add PDFs, Word files, photos of printed pages or typed notes. You get key passages, terms and practice questions. Everything is read on your device; nothing is uploaded."
        actions={
          <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => requestSwitch('new')}>
            New pack
          </button>
        }
      />

      <div className="wrap sd-grid">
        <section className="sd-panel sd-span-5" aria-label="Your material" aria-busy={busy}>
          <h2 className="sd-panel-title">Your material</h2>
          <div
            className={`sd-drop ${dragging ? 'is-dragging' : ''}`}
            onDragEnter={(e) => {
              e.preventDefault()
              if (!busy) setDragging(true)
            }}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              if (!busy) importFiles(e.dataTransfer.files)
            }}
          >
            <p>Drop files here, or</p>
            <div className="sd-inline sd-wrap">
              <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => filesRef.current?.click()}>
                Choose files
              </button>
              <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => cameraRef.current?.click()}>
                Take a photo
              </button>
              <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => setPaste({ open: true, name: '', text: '', error: '' })}>
                Paste notes
              </button>
            </div>
            <p className="mono sd-muted sd-small">PDF, .docx, .txt, JPG, PNG or WebP · up to 10 MB each</p>
            <button
              type="button"
              className="btn-text"
              disabled={busy}
              onClick={() => {
                if (pages.some((p) => p.source === 'Example · Cell biology')) {
                  setFeedback({ message: 'The example is already added. Open it below to read the text.' })
                  return
                }
                try {
                  const incoming = [{ id: crypto.randomUUID(), source: 'Example · Cell biology', label: 'Example notes', text: EXAMPLE_NOTES }]
                  checkLimits(incoming)
                  addPages(incoming)
                  if (!title.trim()) setTitle('Cell biology revision')
                  setFeedback({ message: 'Example added. Read through it, tick the box, then create a sample pack.' })
                } catch (e) {
                  setFeedback({ message: (e as Error).message, error: true })
                }
              }}
            >
              Try an example
            </button>
            <input
              ref={filesRef}
              type="file"
              hidden
              multiple
              accept=".pdf,.docx,.txt,.md,image/jpeg,image/png,image/webp,application/pdf"
              onChange={(e) => {
                const files = [...(e.target.files || [])]
                e.target.value = ''
                importFiles(files)
              }}
            />
            <input
              ref={cameraRef}
              type="file"
              hidden
              accept="image/*"
              capture="environment"
              onChange={(e) => {
                const files = [...(e.target.files || [])]
                e.target.value = ''
                importFiles(files)
              }}
            />
          </div>

          {busy && (
            <div className="sd-progress" role="status">
              <div className="sd-row-between">
                <span>{progress.text}</span>
                <button type="button" className="btn-text" onClick={() => controller.current?.abort()}>
                  Cancel
                </button>
              </div>
              <progress max={100} value={progress.value} />
            </div>
          )}

          <p className="mono sd-muted">{pages.length ? `${plural(pages.length, 'source page')} · ${words.toLocaleString()} words` : 'No material yet'}</p>
          <div className="sd-sources">
            {pages.map((p) => (
              <details key={p.id} id={`sd-src-${p.id}`} className="sd-source" open={openSource === p.id || pages.length === 1} onToggle={(e) => (e.currentTarget.open ? setOpenSource(p.id) : undefined)}>
                <summary>
                  <strong>{p.source}</strong>
                  <span className="mono sd-muted">
                    {p.label} · {wordCount(p.text).toLocaleString()} words
                  </span>
                </summary>
                {p.warning && <p className="sd-warning">{p.warning}</p>}
                <label className="mono sd-label" htmlFor={`sd-src-text-${p.id}`}>
                  Check and correct the text
                </label>
                <textarea
                  id={`sd-src-text-${p.id}`}
                  className="sd-input sd-textarea"
                  rows={8}
                  maxLength={MAX_TEXT_CHARACTERS}
                  value={p.text}
                  onChange={(e) => {
                    const text = e.target.value
                    setPages((prev) => prev.map((x) => (x.id === p.id ? { ...x, text } : x)))
                    markDirty()
                  }}
                />
                <button
                  type="button"
                  className="btn-text sd-danger"
                  disabled={busy}
                  onClick={() => {
                    setPages((prev) => prev.filter((x) => x.id !== p.id))
                    markDirty()
                  }}
                >
                  Remove this {p.label.toLowerCase()}
                </button>
              </details>
            ))}
          </div>

          <div className="sd-rule" />
          <Field label="Pack title" htmlFor="sd-pack-title">
            <input
              id="sd-pack-title"
              className="sd-input"
              maxLength={100}
              placeholder="Week 3 revision"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                setDirty(true)
              }}
            />
          </Field>
          <Field label="Course" htmlFor="sd-pack-course">
            <select
              id="sd-pack-course"
              className="sd-input"
              value={course}
              onChange={(e) => {
                setCourse(e.target.value)
                setDirty(true)
              }}
            >
              <option value="">General revision</option>
              {courseOptions.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Notes length">
            <Segmented
              label="Notes length"
              options={[
                { value: 'quick' as PackLength, label: 'Quick' },
                { value: 'standard' as PackLength, label: 'Standard' },
                { value: 'detailed' as PackLength, label: 'Detailed' },
              ]}
              value={length}
              onChange={(v) => {
                setLength(v)
                setDirty(true)
              }}
            />
          </Field>
          <Field label="Practice questions">
            <Segmented
              label="Practice questions"
              options={[5, 10, 15].map((n) => ({ value: n, label: String(n) }))}
              value={questionCount}
              onChange={(v) => {
                setQuestionCount(v)
                setDirty(true)
              }}
            />
          </Field>
          <label className="sd-check">
            <input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} />
            <span>I’ve checked the text above and corrected any reading mistakes.</span>
          </label>
          <Feedback message={feedback.message} error={feedback.error} />
          <button type="button" className="btn btn-primary sd-full" disabled={busy} onClick={create}>
            Create revision pack
          </button>

          <div className="sd-rule" />
          <h3 className="mono sd-muted">Recent packs</h3>
          {saved.length ? (
            <ul className="sd-list">
              {saved.map((item) => (
                <li key={item.id}>
                  <button type="button" className="sd-list-button" disabled={busy} onClick={() => requestSwitch(item)}>
                    <strong>{item.title}</strong>
                    <span className="mono sd-muted">
                      {item.courseLabel || 'General revision'} · {new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(item.createdAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="sd-muted sd-small">Packs you create are kept here, up to five.</p>
          )}
        </section>

        <section ref={packRef} className="sd-panel sd-span-7" aria-label="Revision pack">
          {!pack ? (
            <div className="sd-empty sd-empty-tall">
              <p className="display sd-empty-title">Read, recall, repeat.</p>
              <p className="sd-muted">Add your material on the left. Your key passages and practice questions appear here.</p>
            </div>
          ) : (
            <>
              <p className="mono sd-muted">{pack.courseLabel || 'General revision'}</p>
              <h2 className="sd-panel-title sd-pack-title">{pack.title}</h2>
              <p className="sd-muted sd-small">
                {pack.wordCount.toLocaleString()} source words · {plural(pack.notes.length, 'key passage')} · {plural(pack.questions.length, 'practice question')}
              </p>
              <div className="sd-inline sd-wrap">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => startFocus({ minutes: 25, task: `${pack.courseLabel ? `${pack.courseLabel.split(' · ')[0]} · ` : ''}${pack.title}` })}
                >
                  Revise for 25 min
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => downloadFile(packAsText(pack), `${pack.title.replace(/[^a-z0-9 -]/gi, '').trim().slice(0, 60) || 'revision-pack'}.txt`, 'text/plain;charset=utf-8')}
                >
                  Download
                </button>
                <button type="button" className="btn btn-outline btn-sm" onClick={print}>
                  Print or save PDF
                </button>
              </div>

              <div className="sd-panel-tabs" role="tablist" aria-label="Pack sections">
                {(['notes', 'questions'] as const).map((name) => (
                  <button
                    key={name}
                    type="button"
                    role="tab"
                    aria-selected={panel === name}
                    tabIndex={panel === name ? 0 : -1}
                    onClick={() => setPanel(name)}
                    onKeyDown={(e) => {
                      if (['ArrowLeft', 'ArrowRight'].includes(e.key)) setPanel(panel === 'notes' ? 'questions' : 'notes')
                    }}
                  >
                    {name === 'notes' ? 'Revision notes' : 'Practice questions'}
                    {panel === name && <motion.span layoutId="sd-pack-line" className="sd-tab-line" transition={{ duration: 0.25, ease: [0.77, 0, 0.175, 1] }} />}
                  </button>
                ))}
              </div>

              {panel === 'notes' ? (
                <div role="tabpanel" className="sd-reveal">
                  {pack.warnings.length > 0 && (
                    <details className="sd-source sd-checks">
                      <summary>
                        <strong>Source checks</strong>
                        <span className="mono sd-muted">{pack.warnings.length}</span>
                      </summary>
                      <ul>
                        {pack.warnings.map((w) => (
                          <li key={w}>{w}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                  {noteGroups.map((notes) => (
                    <section key={`${notes[0].pageId}-${notes[0].heading}`} className="sd-note-group">
                      <h3>{notes[0].heading || notes[0].label}</h3>
                      <ul>
                        {notes.map((n) => (
                          <li key={n.id}>{n.text}</li>
                        ))}
                      </ul>
                      <button type="button" className="btn-text" onClick={() => viewSource(notes[0].pageId)}>
                        {notes[0].source} · {notes[0].label}
                      </button>
                    </section>
                  ))}
                  {pack.definitions.length > 0 && (
                    <section className="sd-note-group">
                      <h3>Key terms to revisit</h3>
                      <p className="sd-terms">
                        {pack.definitions.map((d) => (
                          <span key={d.term}>{d.term}</span>
                        ))}
                      </p>
                    </section>
                  )}
                  <p className="sd-muted sd-small">These are selected passages from your own material, to help you revise. They aren’t complete coverage or an exam prediction.</p>
                </div>
              ) : (
                <div role="tabpanel" className="sd-reveal">
                  <p className="sd-muted sd-small">Try each question from memory before opening the answer guide.</p>
                  <ol className="sd-questions">
                    {pack.questions.map((q) => (
                      <li key={q.id}>
                        <p className="mono sd-muted">{q.kind}</p>
                        <p className="sd-question">{q.prompt}</p>
                        <textarea className="sd-input sd-textarea" rows={3} placeholder="Your answer (kept for this visit only)" aria-label={`Your answer to: ${q.prompt}`} />
                        <details className="sd-answer">
                          <summary>Show answer guide</summary>
                          <p>{q.answer}</p>
                          <button type="button" className="btn-text" onClick={() => viewSource(q.pageId)}>
                            {q.source} · {q.label}
                          </button>
                        </details>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {pack && <pre className="sd-print" aria-hidden>{packAsText(pack)}</pre>}

      <Dialog
        open={paste.open}
        onClose={() => setPaste((p) => ({ ...p, open: false }))}
        eyebrow="Add notes"
        title="Paste or type your notes"
        wide
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              const text = cleanText(paste.text)
              if (!text) {
                setPaste((p) => ({ ...p, error: 'Add some notes first.' }))
                return
              }
              try {
                const name = paste.name.trim() || `Typed notes ${pages.filter((p) => p.label === 'Typed text').length + 1}`
                if (new Set([...pages.map((p) => p.source), name]).size > MAX_SOURCES) throw new Error(`Use up to ${MAX_SOURCES} sources in one pack. Remove one first.`)
                const incoming = [{ id: crypto.randomUUID(), source: name, label: 'Typed text', text }]
                checkLimits(incoming)
                addPages(incoming)
                setPaste({ open: false, name: '', text: '', error: '' })
                setFeedback({ message: 'Notes added. Check the text, then create your pack.' })
              } catch (e) {
                setPaste((p) => ({ ...p, error: (e as Error).message }))
              }
            }}
          >
            Add notes
          </button>
        }
      >
        <Field label="Name" hint="optional" htmlFor="sd-paste-name">
          <input id="sd-paste-name" className="sd-input" maxLength={150} value={paste.name} onChange={(e) => setPaste((p) => ({ ...p, name: e.target.value }))} placeholder="BIO 101 lecture 4" />
        </Field>
        <textarea
          className="sd-input sd-textarea"
          rows={12}
          maxLength={MAX_TEXT_CHARACTERS}
          value={paste.text}
          onChange={(e) => setPaste((p) => ({ ...p, text: e.target.value }))}
          aria-label="Your notes"
          placeholder="Paste or type your notes here. Headings in capitals help group the results."
        />
        <Feedback message={paste.error} error />
      </Dialog>

      <Dialog
        open={pending !== null}
        onClose={() => setPending(null)}
        eyebrow="Unsaved changes"
        title={pending === 'new' ? 'Start a new pack?' : 'Open this saved pack?'}
        actions={
          <>
            <button type="button" className="btn-text" onClick={() => setPending(null)}>
              Keep editing
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                if (pending === 'new') resetDraft()
                else if (pending) loadPack(pending)
                setPending(null)
              }}
            >
              {pending === 'new' ? 'Start new pack' : 'Open saved pack'}
            </button>
          </>
        }
      >
        <p className="sd-muted">Your current material has changes that aren’t in a pack yet. They’ll be cleared. Saved packs stay in Recent packs.</p>
      </Dialog>
    </>
  )
}
