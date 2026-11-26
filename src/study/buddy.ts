// Study Buddy: turns a student's own notes into revision notes, key terms and practice
// questions, entirely on the device. Ported from Focus Garden's buddy-core.
export const BUDDY_STORAGE_KEY = 'focus-garden-revision-v1'
export const MAX_TEXT_CHARACTERS = 150000
export const MAX_SOURCE_PAGES = 40

const STOP_WORDS = new Set(
  'a an the and or but if then than so because as at by for from in into of on onto to up with without about above after again against all also am are be been before being below between both can could did do does doing down during each few further had has have having he her here hers herself him himself his how i im its it itself just me more most my myself no nor not now off once only other our ours ourselves out over own same she should some such that their theirs them themselves there these they this those through too under until very was we were what when where which while who whom why will would you your yours yourself yourselves is may might must shall us used using use often usually much many several however therefore thus example examples chapter page pages figure table note notes lecture section including include includes following given general introduction conclusion one two three four five'.split(
    /\s+/,
  ),
)

export type SourcePage = { id: string; source: string; label: string; text: string; warning?: string }
type Ref = { pageId: string; source: string; label: string }
export type Note = Ref & { id: string; heading: string; text: string }
export type Definition = Ref & { term: string; definition: string }
export type Question = Ref & { id: string; kind: string; prompt: string; answer: string }
export type PackLength = 'quick' | 'standard' | 'detailed'
export type RevisionPack = {
  version: 1
  id: string
  title: string
  courseLabel: string
  createdAt: number
  length: PackLength
  wordCount: number
  sourceCount: number
  coveredSourceCount: number
  notes: Note[]
  definitions: Definition[]
  questions: Question[]
  warnings: string[]
  pages: SourcePage[]
}

export function cleanText(value: unknown) {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/\u0000/g, '')
    .replace(/­/g, '')
    .replace(/([a-z])-\n([a-z])/gi, '$1$2')
    .replace(/[\t  ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/([\p{L},])\n\n(?=[a-z])/gu, '$1 ')
    .trim()
}

export const wordCount = (value: string) => (value.match(/[\p{L}\p{N}]+(?:[-’'][\p{L}\p{N}]+)*/gu) || []).length

const terms = (value: string) =>
  (value.toLowerCase().match(/[a-z][a-z’'-]{2,}/g) || []).map((t) => t.replace(/['’]s$/, '')).filter((t) => !STOP_WORDS.has(t))

export function validateSources(input: Partial<SourcePage>[]): SourcePage[] {
  if (!Array.isArray(input) || !input.length) throw new Error('Add a document, a photo or some typed notes first.')
  if (input.length > MAX_SOURCE_PAGES) throw new Error(`Use up to ${MAX_SOURCE_PAGES} source pages in one pack.`)
  const pages = input.map((p, i) => ({
    id: String(p.id || `source-${i + 1}`),
    source: String(p.source || 'My notes').slice(0, 150),
    label: String(p.label || 'Text').slice(0, 80),
    text: cleanText(p.text),
    ...(p.warning ? { warning: String(p.warning).slice(0, 400) } : {}),
  }))
  if (pages.reduce((sum, p) => sum + p.text.length, 0) > MAX_TEXT_CHARACTERS) {
    throw new Error('This pack is too long. Use up to 150,000 characters, or split your material into smaller packs.')
  }
  if (pages.reduce((sum, p) => sum + wordCount(p.text), 0) < 35) {
    throw new Error('Add at least 35 readable words. Correct any photo reading errors before creating a pack.')
  }
  return pages
}

function sentenceParts(text: string) {
  if (globalThis.Intl?.Segmenter) return [...new Intl.Segmenter('en', { granularity: 'sentence' }).segment(text)].map((p) => p.segment.trim())
  return text.match(/[^.!?]+(?:[.!?]+|$)/g)?.map((p) => p.trim()) || []
}

type Unit = Note & { pageIndex: number; order: number }

const BULLET = /^(?:[-•●▪]|\d+[.)])\s/

function unitsFromPage(page: SourcePage, pageIndex: number): Unit[] {
  const units: Unit[] = []
  let heading = ''
  for (const rawParagraph of page.text.split(/\n\s*\n/)) {
    const lines = rawParagraph.split('\n').map((l) => l.trim()).filter(Boolean)
    let paragraph: string[] = []
    const flush = () => {
      if (!paragraph.length) return
      for (const sentence of sentenceParts(paragraph.join(' '))) {
        const pieces = sentence.length > 650 ? sentence.split(/;\s+|\n/) : [sentence]
        for (const piece of pieces) {
          const value = piece.replace(/^[-•●▪]\s*/, '').trim()
          if (value.length >= 22 && value.length <= 1400 && wordCount(value) >= 4 && terms(value).length >= 2) {
            units.push({ id: `${page.id}-u${units.length + 1}`, pageId: page.id, source: page.source, label: page.label, pageIndex, heading, text: value, order: units.length })
          }
        }
      }
      paragraph = []
    }
    for (const line of lines) {
      const isHeading =
        line.length < 85 &&
        wordCount(line) <= 10 &&
        !/[.!?;=]$/.test(line) &&
        !BULLET.test(line) &&
        (line === line.toUpperCase() || /^#{1,3}\s/.test(line) || /:$/.test(line))
      if (isHeading) {
        flush()
        heading = line.replace(/^#{1,3}\s+|:$/g, '').trim()
      } else if (BULLET.test(line)) {
        flush()
        paragraph.push(line.replace(/^(?:[-•●▪]|\d+[.)])\s*/, ''))
        flush()
      } else paragraph.push(line)
    }
    flush()
  }
  return units
}

const reference = (u: Ref): Ref => ({ pageId: u.pageId, source: u.source, label: u.label })

function definitionFromUnit(unit: Unit): Definition | null {
  const match = unit.text.match(
    /^(.{3,75}?)\s+(?:is defined as|are defined as|refers to|is referred to as|means|is the process\b|is a\b|is an\b|are a\b|are the\b|is the\b)\s*(.{12,})/i,
  )
  if (!match) return null
  const term = match[1].replace(/^(?:the|a|an)\s+/i, '').replace(/^[\d.)\s]+/, '').trim()
  if (
    wordCount(term) > 8 ||
    wordCount(term) < 1 ||
    /^(?:it|this|that|there|these|they|here|what|which|one|each)\b/i.test(term) ||
    /\b(?:contains?|consists?|includes?|helps?|releases?|moves?|requires?|controls?|and|or)\b/i.test(term)
  )
    return null
  return { term, definition: unit.text, ...reference(unit) }
}

const uniqueKey = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
const escapedRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function makeQuestions(selected: Unit[], definitions: Definition[], requested: number): Question[] {
  const candidates: Omit<Question, 'id'>[] = []
  const usedUnits = new Set<string>()
  for (const d of definitions) {
    const unit = selected.find((u) => u.text === d.definition)
    if (!unit) continue
    candidates.push({ kind: 'Explain a concept', prompt: `Explain the term “${d.term}” using your notes.`, answer: unit.text, ...reference(unit) })
    usedUnits.add(unit.id)
  }
  for (const unit of selected) {
    if (usedUnits.has(unit.id)) continue
    const numbers = [...unit.text.matchAll(/\b\d+(?:\.\d+)?(?:\s*%|\s*(?:°C|kg|km|cm|mm|mol|seconds|minutes|hours))?/g)].map((m) => m[0])
    const number = numbers.find((v) => !/^\d$/.test(v)) || numbers[0]
    const word = terms(unit.text)
      .filter((v) => v.length > 4)
      .sort((a, b) => b.length - a.length)[0]
    const target = number || (word && unit.text.match(new RegExp(`\\b${escapedRegex(word)}\\b`, 'i'))?.[0])
    if (target) {
      const prompt = unit.text.replace(new RegExp(escapedRegex(target), 'i'), '________')
      candidates.push({ kind: 'Complete the statement', prompt, answer: `${target}\n\nFull passage: ${unit.text}`, ...reference(unit) })
    } else {
      candidates.push({
        kind: 'Recall the point',
        prompt: `What does your material say about ${unit.heading || 'this topic'} in ${unit.label.toLowerCase()}? Write the point in your own words, then compare it with the source passage.`,
        answer: unit.text,
        ...reference(unit),
      })
    }
  }
  // Cover every source page once before filling the remaining question slots.
  const questions: Omit<Question, 'id'>[] = []
  const seenPages = new Set<string>()
  for (const c of candidates) {
    if (!seenPages.has(c.pageId) && questions.length < requested) {
      questions.push(c)
      seenPages.add(c.pageId)
    }
  }
  for (const c of candidates) if (!questions.includes(c) && questions.length < requested) questions.push(c)
  return questions.map((q, i) => ({ ...q, id: `question-${i + 1}` }))
}

export function createRevisionPack({
  pages: input,
  title,
  courseLabel = '',
  length = 'standard',
  questionCount = 10,
  now = Date.now(),
  id = crypto.randomUUID(),
}: {
  pages: Partial<SourcePage>[]
  title: string
  courseLabel?: string
  length?: PackLength
  questionCount?: number
  now?: number
  id?: string
}): RevisionPack {
  const pages = validateSources(input)
  if (!['quick', 'standard', 'detailed'].includes(length)) throw new Error('Choose a revision note length.')
  if (![5, 10, 15].includes(Number(questionCount))) throw new Error('Choose 5, 10 or 15 practice questions.')
  const seen = new Set<string>()
  const units = pages.flatMap(unitsFromPage).filter((u) => {
    const key = uniqueKey(u.text)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  if (units.length < 2) throw new Error('There is not enough clear material to make useful notes. Add a few complete sentences and try again.')
  const frequencies = new Map<string, number>()
  for (const u of units) for (const t of new Set(terms(u.text))) frequencies.set(t, (frequencies.get(t) || 0) + 1)
  const ranked = units
    .map((u) => {
      const tokens = terms(u.text)
      const headingTokens = new Set(terms(u.heading))
      const score =
        tokens.reduce((sum, t) => sum + Math.log(1 + (frequencies.get(t) || 0)) + (headingTokens.has(t) ? 0.8 : 0), 0) / Math.sqrt(Math.max(tokens.length, 1)) +
        (definitionFromUnit(u) ? 2 : 0) +
        (/[=±²³]|\b(?:formula|because|therefore|causes|results|consists|types|stages|steps|important|principle|law)\b/i.test(u.text) ? 1.3 : 0) +
        (u.order === 0 ? 0.25 : 0)
      return { ...u, score }
    })
    .sort((a, b) => b.score - a.score)
  const limits = { quick: { cap: 8, ratio: 0.3 }, standard: { cap: 14, ratio: 0.45 }, detailed: { cap: 24, ratio: 0.65 } }[length]
  const target = Math.min(
    units.length,
    Math.max(Math.min(limits.cap, Math.max(3, Math.ceil(units.length * limits.ratio))), new Set(units.map((u) => u.pageId)).size),
  )
  const selected: (Unit & { score: number })[] = []
  for (const p of pages) {
    const first = ranked.find((u) => u.pageId === p.id)
    if (first) selected.push(first)
  }
  for (const u of ranked) {
    if (selected.length >= target) break
    if (!selected.includes(u)) selected.push(u)
  }
  selected.sort((a, b) => a.pageIndex - b.pageIndex || a.order - b.order)
  const termSeen = new Set<string>()
  const definitions = selected
    .map(definitionFromUnit)
    .filter((d): d is Definition => {
      if (!d || termSeen.has(d.term.toLowerCase())) return false
      termSeen.add(d.term.toLowerCase())
      return true
    })
    .slice(0, 10)
  const questionUnits = [...selected]
  for (const u of ranked) {
    if (questionUnits.length >= Math.max(Number(questionCount), target)) break
    if (!questionUnits.includes(u)) questionUnits.push(u)
  }
  const questionDefinitions = questionUnits.map(definitionFromUnit).filter((d): d is Definition => Boolean(d))
  const questions = makeQuestions(questionUnits, questionDefinitions, Number(questionCount))
  const emptyPages = pages.filter((p) => !units.some((u) => u.pageId === p.id))
  const warnings = pages.filter((p) => p.warning).map((p) => `${p.source} · ${p.label}: ${p.warning}`)
  if (emptyPages.length) {
    warnings.push(`${emptyPages.length} source ${emptyPages.length === 1 ? 'page had' : 'pages had'} no complete readable passages and could not be summarised.`)
  }
  return {
    version: 1,
    id,
    title: cleanText(title).slice(0, 100) || 'My revision pack',
    courseLabel: String(courseLabel).slice(0, 200),
    createdAt: now,
    length,
    wordCount: pages.reduce((sum, p) => sum + wordCount(p.text), 0),
    sourceCount: pages.length,
    coveredSourceCount: new Set(selected.map((u) => u.pageId)).size,
    notes: selected.map(({ score: _s, pageIndex: _p, order: _o, ...note }) => note),
    definitions,
    questions,
    warnings,
    pages,
  }
}

export function packAsText(pack: RevisionPack) {
  const cite = (item: Ref) => `${item.source} · ${item.label}`
  const lines = [
    pack.title,
    ...(pack.courseLabel ? [pack.courseLabel] : []),
    'GLT ILE-IFE STUDY SPACE · REVISION PACK',
    '',
    'Selected passages from your reviewed text. These notes are an aid to revision, not complete coverage or an exam prediction.',
    '',
    'REVISION NOTES',
    ...pack.notes.flatMap((n, i) => [`${i + 1}. ${n.text}`, `   Source: ${cite(n)}`, '']),
  ]
  if (pack.definitions.length) lines.push('KEY TERMS', ...pack.definitions.flatMap((d) => [d.term, d.definition, `Source: ${cite(d)}`, '']))
  lines.push('PRACTICE QUESTIONS', ...pack.questions.flatMap((q, i) => [`${i + 1}. ${q.kind}`, q.prompt, `Source: ${cite(q)}`, '']))
  lines.push('ANSWER GUIDE', ...pack.questions.flatMap((q, i) => [`${i + 1}. ${q.answer}`, `Source: ${cite(q)}`, '']))
  if (pack.warnings.length) lines.push('SOURCE CHECKS', ...pack.warnings, '')
  return lines.join('\n')
}

export function normalizeSavedPacks(value: unknown): RevisionPack[] {
  if (!Array.isArray(value)) return []
  return value
    .filter(
      (p) =>
        p &&
        p.version === 1 &&
        typeof p.id === 'string' &&
        typeof p.title === 'string' &&
        Number.isFinite(p.createdAt) &&
        Number.isFinite(p.wordCount) &&
        typeof p.courseLabel === 'string' &&
        Array.isArray(p.notes) &&
        Array.isArray(p.questions) &&
        Array.isArray(p.pages) &&
        Array.isArray(p.definitions) &&
        Array.isArray(p.warnings) &&
        [...p.notes, ...p.questions, ...p.definitions].every((i: any) => i && typeof i.source === 'string' && typeof i.label === 'string') &&
        p.notes.every((n: any) => typeof n.text === 'string') &&
        p.questions.every((q: any) => typeof q.prompt === 'string' && typeof q.answer === 'string') &&
        p.pages.every((pg: any) => pg && typeof pg.id === 'string' && typeof pg.text === 'string' && typeof pg.source === 'string' && typeof pg.label === 'string'),
    )
    .slice(0, 5)
}

export const EXAMPLE_NOTES = `CELL BIOLOGY

A cell is the basic structural and functional unit of living organisms. All living organisms consist of one or more cells. Cells arise from pre-existing cells through cell division.

The cell membrane is a selectively permeable barrier that controls the movement of substances into and out of a cell. Diffusion is the movement of particles from a region of higher concentration to a region of lower concentration. Diffusion does not require energy from ATP.

Osmosis is the net movement of water through a selectively permeable membrane from a region of higher water potential to a region of lower water potential. Active transport moves substances against their concentration gradient and requires energy.

ORGANELLES

The nucleus contains the genetic material and helps control cellular activities. Mitochondria release energy during aerobic respiration. Ribosomes are the sites of protein synthesis. Plant cells contain a cellulose cell wall, chloroplasts and a large central vacuole. Chloroplasts contain chlorophyll and are the sites of photosynthesis.

REVISION CHECK

Animal cells do not have a cellulose cell wall or chloroplasts. Compare plant and animal cells using their structures and functions. Check the diagrams in your full notes and practise labelling them.`

export const MAX_SOURCES = 6
