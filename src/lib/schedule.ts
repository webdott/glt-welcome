import type { Gathering, Programme } from '#/content'
import { church, gatherings } from '#/content'

// Ile-Ife runs on WAT (UTC+1) all year, so a fixed offset is exact.
const WAT_OFFSET = 60 * 60 * 1000
const TZ = 'Africa/Lagos'

const hm = (t: string) => t.split(':').map(Number) as [number, number]

function watInstant(y: number, m: number, d: number, h: number, min: number) {
  return Date.UTC(y, m, d, h, min) - WAT_OFFSET
}

function lastSundayOfMonth(y: number, m: number) {
  const last = new Date(Date.UTC(y, m + 1, 0))
  return last.getUTCDate() - last.getUTCDay()
}

function isLastSunday(y: number, m: number, d: number) {
  return lastSundayOfMonth(y, m) === new Date(Date.UTC(y, m, d)).getUTCDate()
}

function durationOf(g: Gathering) {
  const [sh, sm] = hm(g.start)
  const [eh, em] = hm(g.end)
  return (eh * 60 + em - (sh * 60 + sm)) * 60 * 1000
}

/** Start instants of a gathering over the next ~10 weeks, in order. */
function occurrences(g: Gathering, from: number): number[] {
  const [h, min] = hm(g.start)
  const wat = new Date(from + WAT_OFFSET)
  const y = wat.getUTCFullYear()
  const m = wat.getUTCMonth()
  const d = wat.getUTCDate()
  const out: number[] = []

  if (g.recurrence === 'last-sun') {
    for (let i = 0; i < 3; i++) {
      const date = new Date(Date.UTC(y, m + i, 1))
      const ly = date.getUTCFullYear()
      const lm = date.getUTCMonth()
      out.push(watInstant(ly, lm, lastSundayOfMonth(ly, lm), h, min))
    }
    return out
  }

  const dow = g.recurrence === 'weekly-sun' ? 0 : 3
  for (let i = 0; i < 70; i++) {
    const day = new Date(Date.UTC(y, m, d + i))
    if (day.getUTCDay() !== dow) continue
    const [dy, dm, dd] = [day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()]
    // On the last Sunday, SMS replaces both regular services.
    if (dow === 0 && isLastSunday(dy, dm, dd)) continue
    out.push(watInstant(dy, dm, dd, h, min))
  }
  return out
}

export type Upcoming = { gathering: Gathering; at: number; live: boolean }

export function nextFor(g: Gathering, now = Date.now()): Upcoming {
  const dur = durationOf(g)
  const at = occurrences(g, now - dur).find((t) => t + dur > now)!
  return { gathering: g, at, live: at <= now }
}

export function nextGathering(now = Date.now()): Upcoming {
  return gatherings
    .map((g) => nextFor(g, now))
    .sort((a, b) => a.at - b.at)[0]
}

const dayFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})
const longDayFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})
const timeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
})

export const formatDay = (t: number) => dayFmt.format(t)
export const formatLongDay = (t: number) => longDayFmt.format(t)
export const formatTime = (t: number) => timeFmt.format(t).replace(' ', '').toLowerCase()

export function formatCountdown(ms: number) {
  if (ms <= 0) return 'Happening now'
  const mins = Math.floor(ms / 60000)
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  const m = mins % 60
  if (d > 0) return `in ${d}d ${h}h`
  if (h > 0) return `in ${h}h ${m}m`
  return `in ${Math.max(m, 1)}m`
}

const watDay = (t: number) => Math.floor((t + WAT_OFFSET) / 86_400_000)
export const isEvening = (t: number) => new Date(t + WAT_OFFSET).getUTCHours() >= 17

export type ProgrammeStatus =
  | { kind: 'days'; days: number }
  | { kind: 'tomorrow' }
  | { kind: 'today'; startsIn: number }
  | { kind: 'live' }
  | { kind: 'past' }

export function programmeStatus(startsAt: string, durationHours: number, now: number): ProgrammeStatus {
  const start = Date.parse(startsAt)
  if (now >= start + durationHours * 3_600_000) return { kind: 'past' }
  if (now >= start) return { kind: 'live' }
  const days = watDay(start) - watDay(now)
  if (days === 0) return { kind: 'today', startsIn: start - now }
  if (days === 1) return { kind: 'tomorrow' }
  return { kind: 'days', days }
}

/* Calendar files */

const stamp = (t: number) =>
  new Date(t + WAT_OFFSET).toISOString().replace(/[-:]/g, '').slice(0, 15)

const RRULES: Record<Gathering['recurrence'], string> = {
  // Every Sunday except the last of the month (SMS replaces it).
  'weekly-sun': 'FREQ=MONTHLY;BYDAY=SU;BYSETPOS=-5,-4,-3,-2',
  'weekly-wed': 'FREQ=WEEKLY;BYDAY=WE',
  'last-sun': 'FREQ=MONTHLY;BYDAY=-1SU',
}

function ics(event: { uid: string; title: string; start: number; end: number; rrule?: string; description: string; location: string }) {
  const esc = (s: string) => s.replace(/[\\,;]/g, (c) => `\\${c}`)
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//GLT Ile-Ife//Welcome//EN',
    'BEGIN:VTIMEZONE',
    `TZID:${TZ}`,
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:+0100',
    'TZOFFSETTO:+0100',
    'TZNAME:WAT',
    'END:STANDARD',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    `UID:${event.uid}@glt-ife`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    `DTSTART;TZID=${TZ}:${stamp(event.start)}`,
    `DTEND;TZID=${TZ}:${stamp(event.end)}`,
    ...(event.rrule ? [`RRULE:${event.rrule}`] : []),
    `SUMMARY:${esc(event.title)}`,
    `DESCRIPTION:${esc(event.description)}`,
    `LOCATION:${esc(event.location)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}

function download(name: string, body: string) {
  const url = URL.createObjectURL(new Blob([body], { type: 'text/calendar' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadGathering(g: Gathering) {
  const { at } = nextFor(g)
  download(
    `glt-ife-${g.id}.ics`,
    ics({
      uid: g.id,
      title: `${g.name} · GLT Ile-Ife`,
      start: at,
      end: at + durationOf(g),
      rrule: RRULES[g.recurrence],
      description: g.note,
      location: church.address,
    }),
  )
}

export function downloadProgramme(p: Programme) {
  const start = Date.parse(p.startsAt)
  download(
    `glt-ife-${p.title.toLowerCase().replace(/\s+/g, '-')}.ics`,
    ics({
      uid: p.title,
      title: `${p.title} · GLT Ile-Ife`,
      start,
      end: start + p.durationHours * 3_600_000,
      description: [p.blurb, p.transport].filter(Boolean).join(' '),
      location: `${p.venue}, ${p.address}`,
    }),
  )
}

