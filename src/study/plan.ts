// Study timetable: course lists, CSV in/out, the one-month rotation and reminders.
// Ported from Focus Garden's study-core.
export const STUDY_STORAGE_KEY = 'focus-garden-study-v1'
export const BREAK_MINUTES = 15
export const BLOCK_MINUTES = [25, 45, 60, 90] as const
export const REMINDER_MINUTES = [0, 5, 10, 15, 30] as const

export type Course = { id: string; code: string; title: string }
export type Preferences = {
  startDate: string
  days: number[]
  startTime: string
  endTime: string
  minutes: number
  reminderMinutes: number
}
export type PlannedSession = {
  id: string
  courseId: string
  code: string
  title: string
  minutes: number
  startAt: number
  endAt: number
  date: string
}
export type Plan = {
  semesterId: string
  semesterName: string
  revision: number
  generatedAt: number
  startDate: string
  endDate: string
  timeZone: string
  preferences: Preferences
  sessions: PlannedSession[]
}
export type Reminder = { id: string; sessionId: string; type: 'upcoming' | 'due'; createdAt: number; read: boolean }
export type StudyState = {
  version: 1
  semesterId: string
  semesterName: string
  courses: Course[]
  preferences: Preferences
  plan: Plan | null
  remindersEnabled: boolean
  notifications: Reminder[]
}

export function dateKey(value: number | Date) {
  const d = new Date(value)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) throw new Error('Choose a valid start date.')
  const date = new Date(`${value}T00:00:00`)
  if (!Number.isFinite(date.getTime()) || dateKey(date) !== value) throw new Error('Choose a valid start date.')
  return date
}

/** Same day next month, clamped to that month's length; the plan runs up to but not including it. */
export function monthEndExclusive(value: string) {
  const d = parseDate(value)
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 2, 0).getDate()
  return dateKey(new Date(d.getFullYear(), d.getMonth() + 1, Math.min(d.getDate(), lastDay)))
}

export function initialStudyState(now = Date.now()): StudyState {
  return {
    version: 1,
    semesterId: crypto.randomUUID(),
    semesterName: 'Current semester',
    courses: [],
    preferences: { startDate: dateKey(now), days: [1, 2, 3, 4, 5, 6], startTime: '19:00', endTime: '21:00', minutes: 45, reminderMinutes: 15 },
    plan: null,
    remindersEnabled: true,
    notifications: [],
  }
}

export const courseKey = (code: string) => code.toUpperCase().replace(/\s+/g, '')

export function normalizeCourses(rows: { id?: string; code?: string; title?: string }[]): Course[] {
  const codes = new Set<string>()
  const courses: Course[] = []
  rows.forEach((row, index) => {
    const code = String(row.code || '').trim().replace(/\s+/g, ' ').toUpperCase()
    const title = String(row.title || '').trim().replace(/\s+/g, ' ')
    if (!code && !title) return
    if (!code || !title) throw new Error(`Add both a course code and a title on row ${index + 1}.`)
    if (code.length > 30 || title.length > 160) throw new Error(`Shorten the course code or title on row ${index + 1}.`)
    if (codes.has(courseKey(code))) throw new Error(`${code} appears more than once. Keep one row for each course.`)
    codes.add(courseKey(code))
    courses.push({ id: row.id || crypto.randomUUID(), code, title })
  })
  if (!courses.length) throw new Error('Add at least one course to create your study timetable.')
  return courses
}

/** Reads a two-column list (code, title) from CSV or tab-separated text, with or without headings. */
export function parseCourseCSV(text: string): Course[] {
  const source = String(text).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  const firstLine = source.split('\n').find((l) => l.trim()) || ''
  const delimiter = firstLine.includes('\t') && !firstLine.includes(',') ? '\t' : ','
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  let quoteClosed = false
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i]
    if (quoted) {
      if (ch === '"' && source[i + 1] === '"') {
        field += '"'
        i += 1
      } else if (ch === '"') {
        quoted = false
        quoteClosed = true
      } else field += ch
    } else if (ch === delimiter || ch === '\n') {
      row.push(field.trim())
      field = ''
      quoteClosed = false
      if (ch === '\n') {
        if (row.some((v) => v)) rows.push(row)
        row = []
      }
    } else if (ch === '"' && !field.trim() && !quoteClosed) {
      field = ''
      quoted = true
    } else if (quoteClosed && ch.trim()) throw new Error('Check the quotation marks in your course file.')
    else field += ch
  }
  if (quoted) throw new Error('A quoted course title is missing its closing quotation mark.')
  row.push(field.trim())
  if (row.some((v) => v)) rows.push(row)
  if (!rows.length) throw new Error('Your course list is empty. Add course codes and titles.')
  const headers = rows[0].map((v) => v.toLowerCase().replace(/[\s_-]+/g, ''))
  const codeColumn = headers.findIndex((v) => ['code', 'coursecode'].includes(v))
  const titleColumn = headers.findIndex((v) => ['title', 'coursetitle', 'coursename'].includes(v))
  const hasHeader = codeColumn >= 0 || titleColumn >= 0
  if (hasHeader && (codeColumn < 0 || titleColumn < 0)) throw new Error('Use the column headings Course code and Course title.')
  return normalizeCourses(
    (hasHeader ? rows.slice(1) : rows).map((values, index) => {
      if (!hasHeader && values.length !== 2) {
        throw new Error(`Row ${index + 1} needs two columns. Put titles containing commas inside double quotes.`)
      }
      return { code: values[hasHeader ? codeColumn : 0], title: values[hasHeader ? titleColumn : 1] }
    }),
  )
}

function minutesOfDay(value: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value || '')) throw new Error('Choose a valid study start and end time.')
  const [h, m] = value.split(':').map(Number)
  return h * 60 + m
}

export function validatePreferences(p: Preferences): Preferences {
  parseDate(p.startDate)
  const days = [...new Set(p.days)].sort((a, b) => a - b)
  if (!days.length || days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) throw new Error('Choose at least one study day.')
  const start = minutesOfDay(p.startTime)
  let end = minutesOfDay(p.endTime)
  if (end === start) throw new Error('Choose different start and end times for your study window.')
  if (end < start) end += 1440
  if (!(BLOCK_MINUTES as readonly number[]).includes(p.minutes)) throw new Error('Choose a study block of 25, 45, 60 or 90 minutes.')
  if (end - start < p.minutes) throw new Error('Your study window needs enough time for at least one full study block.')
  if (!(REMINDER_MINUTES as readonly number[]).includes(p.reminderMinutes)) throw new Error('Choose a valid reminder time.')
  return { ...p, days }
}

/** Fills every study window for one month with blocks, rotating through the courses in order. */
export function generateStudyPlan({
  courses,
  preferences,
  semesterId,
  semesterName,
  revision = 1,
  now = Date.now(),
}: {
  courses: Course[]
  preferences: Preferences
  semesterId: string
  semesterName: string
  revision?: number
  now?: number
}): Plan {
  const checkedCourses = normalizeCourses(courses)
  const checked = validatePreferences(preferences)
  const start = parseDate(checked.startDate)
  const endDate = monthEndExclusive(checked.startDate)
  const end = parseDate(endDate)
  const startMinute = minutesOfDay(checked.startTime)
  let endMinute = minutesOfDay(checked.endTime)
  if (endMinute < startMinute) endMinute += 1440
  const slots: { startAt: number; endAt: number; date: string }[] = []
  for (const day = new Date(start); day < end; day.setDate(day.getDate() + 1)) {
    if (!checked.days.includes(day.getDay())) continue
    for (let minute = startMinute; minute + checked.minutes <= endMinute; minute += checked.minutes + BREAK_MINUTES) {
      const begins = new Date(day)
      begins.setMinutes(minute)
      const ends = begins.getTime() + checked.minutes * 60000
      const prior = slots.at(-1)
      if (ends <= end.getTime() && (!prior || begins.getTime() >= prior.endAt)) {
        slots.push({ startAt: begins.getTime(), endAt: ends, date: dateKey(begins) })
      }
    }
  }
  if (slots.length < checkedCourses.length) {
    throw new Error(
      `Your month has ${slots.length} study blocks for ${checkedCourses.length} courses. Add study days, extend your hours or choose a shorter block.`,
    )
  }
  return {
    semesterId,
    semesterName: semesterName.trim().slice(0, 60) || 'Current semester',
    revision,
    generatedAt: now,
    startDate: checked.startDate,
    endDate,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    preferences: checked,
    sessions: slots.map((slot, index) => {
      const course = checkedCourses[index % checkedCourses.length]
      return { ...slot, id: `${semesterId}-${course.id}-${slot.startAt}`, courseId: course.id, code: course.code, title: course.title, minutes: checked.minutes }
    }),
  }
}

export function normalizeStudyState(value: any): StudyState {
  const fallback = initialStudyState()
  if (!value || value.version !== 1) return fallback
  const output: StudyState = {
    ...fallback,
    semesterId: typeof value.semesterId === 'string' ? value.semesterId : fallback.semesterId,
    semesterName: String(value.semesterName || 'Current semester').slice(0, 60),
    remindersEnabled: value.remindersEnabled !== false,
  }
  try {
    output.preferences = validatePreferences(value.preferences)
  } catch {
    output.preferences = fallback.preferences
  }
  try {
    output.courses = normalizeCourses(Array.isArray(value.courses) ? value.courses : [])
  } catch {
    output.courses = []
  }
  const plan = value.plan
  if (
    plan &&
    Array.isArray(plan.sessions) &&
    plan.sessions.length &&
    plan.sessions.every(
      (s: any) =>
        s &&
        typeof s.id === 'string' &&
        typeof s.code === 'string' &&
        typeof s.title === 'string' &&
        Number.isFinite(s.startAt) &&
        Number.isFinite(s.endAt) &&
        s.endAt > s.startAt &&
        Number.isInteger(s.minutes) &&
        typeof s.date === 'string',
    )
  ) {
    try {
      parseDate(plan.startDate)
      parseDate(plan.endDate)
      new Intl.DateTimeFormat(undefined, { timeZone: plan.timeZone }).format()
      output.plan = plan
    } catch {
      output.plan = null
    }
  }
  const ids = new Set(output.plan?.sessions.map((s) => s.id) || [])
  output.notifications = Array.isArray(value.notifications)
    ? value.notifications.filter(
        (n: any) => n && typeof n.id === 'string' && ids.has(n.sessionId) && ['upcoming', 'due'].includes(n.type) && Number.isFinite(n.createdAt),
      )
    : []
  return output
}

/** Reminders that have just become relevant and haven't been raised before. */
export function dueReminders(plan: Plan | null, notifications: Reminder[], leadMinutes: number, now = Date.now()): Reminder[] {
  if (!plan) return []
  const seen = new Set(notifications.map((n) => n.id))
  return plan.sessions
    .filter((s) => now >= s.startAt - leadMinutes * 60000 && now < s.endAt)
    .map((s) => {
      const type: Reminder['type'] = now < s.startAt ? 'upcoming' : 'due'
      return { id: `${s.id}-${type}`, sessionId: s.id, type, createdAt: now, read: false }
    })
    .filter((n) => !seen.has(n.id))
}

const escapeCalendarText = (v: string) =>
  String(v).replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')

const calendarTimestamp = (t: number) => new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')

function foldCalendarLine(line: string) {
  const encoder = new TextEncoder()
  const parts: string[] = []
  let part = ''
  let bytes = 0
  for (const ch of line) {
    const size = encoder.encode(ch).length
    if (bytes + size > 75) {
      parts.push(part)
      part = ' '
      bytes = 1
    }
    part += ch
    bytes += size
  }
  parts.push(part)
  return parts.join('\r\n')
}

export function createCalendarFile(plan: Plan, reminderMinutes: number, pageUrl: string, now = Date.now()) {
  if (!plan?.sessions?.length) throw new Error('Create your study timetable first.')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//GLT Ile-Ife//Study Timetable//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeCalendarText(`Study - ${plan.semesterName}`)}`,
    `X-WR-TIMEZONE:${escapeCalendarText(plan.timeZone)}`,
  ]
  for (const s of plan.sessions) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${s.id}@glt-ife.study`,
      `DTSTAMP:${calendarTimestamp(now)}`,
      `DTSTART:${calendarTimestamp(s.startAt)}`,
      `DTEND:${calendarTimestamp(s.endAt)}`,
      `SEQUENCE:${plan.revision || 1}`,
      `SUMMARY:${escapeCalendarText(`Study ${s.code} - ${s.title}`)}`,
      `DESCRIPTION:${escapeCalendarText(`${s.minutes} minutes of study for ${plan.semesterName}.\nOpen the study space to start your timer.\n${pageUrl}`)}`,
      `URL:${pageUrl}`,
      'STATUS:CONFIRMED',
      'TRANSP:OPAQUE',
      'BEGIN:VALARM',
      `TRIGGER:${reminderMinutes ? `-PT${reminderMinutes}M` : 'PT0S'}`,
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeCalendarText(`Time to study ${s.code}`)}`,
      'END:VALARM',
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.map(foldCalendarLine).join('\r\n') + '\r\n'
}

export function createCoursesCSV(courses: Course[]) {
  const cell = (v: string) => `"${String(v).replace(/"/g, '""')}"`
  return ['Course code,Course title', ...courses.map((c) => `${cell(c.code)},${cell(c.title)}`)].join('\r\n') + '\r\n'
}
