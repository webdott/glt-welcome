import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BLOCK_MINUTES,
  REMINDER_MINUTES,
  courseKey,
  createCalendarFile,
  createCoursesCSV,
  dateKey,
  generateStudyPlan,
  initialStudyState,
  normalizeCourses,
  parseCourseCSV,
} from '../plan'
import type { Course, Preferences } from '../plan'
import { Arrow, Plus } from '../../components/icons'
import { useStudy } from './context'
import { Dialog, Feedback, Field, Segmented } from './primitives'
import { downloadFile, plural, storageAvailable } from './stored'
import { TabHero } from './TabHero'

const DAYS = [
  { value: 1, label: 'Mo' },
  { value: 2, label: 'Tu' },
  { value: 3, label: 'We' },
  { value: 4, label: 'Th' },
  { value: 5, label: 'Fr' },
  { value: 6, label: 'Sa' },
  { value: 0, label: 'Su' },
]
const blank = (): Course => ({ id: crypto.randomUUID(), code: '', title: '' })
const blanks = () => [blank(), blank(), blank()]
const filled = (rows: Course[]) => rows.filter((c) => c.code.trim() || c.title.trim())
const shortDay = (key: string, year = false) =>
  new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}) }).format(new Date(`${key}T12:00:00`))

export function TimetableTab() {
  const { study, setStudy, startFocus, now } = useStudy()
  const [draft, setDraft] = useState<Course[]>(blanks)
  const [prefs, setPrefs] = useState<Preferences>(study.preferences)
  const [name, setName] = useState(study.semesterName)
  const [dirty, setDirty] = useState(false)
  const [feedback, setFeedback] = useState<{ message: string; error?: boolean }>({ message: '' })
  const [week, setWeek] = useState(0)
  const [dialog, setDialog] = useState<'paste' | 'semester' | 'calendar' | null>(null)
  const [pasted, setPasted] = useState('')
  const [pasteError, setPasteError] = useState('')
  const [newName, setNewName] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // Load saved courses and preferences (after mount, or when another tab changes them) unless mid-edit.
  useEffect(() => {
    if (dirty) return
    setDraft(study.courses.length ? study.courses.map((c) => ({ ...c })) : blanks())
    setPrefs(study.preferences)
    setName(study.semesterName)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [study.courses, study.preferences, study.semesterName])

  const plan = study.plan
  const days = useMemo(() => {
    if (!plan) return []
    const out: string[] = []
    const end = new Date(`${plan.endDate}T12:00:00`)
    for (const d = new Date(`${plan.startDate}T12:00:00`); d < end; d.setDate(d.getDate() + 1)) out.push(dateKey(d))
    return out
  }, [plan])
  const weeks = Math.max(1, Math.ceil(days.length / 7))

  // Open on the week containing today.
  const planId = plan ? `${plan.semesterId}-${plan.revision}` : ''
  useEffect(() => {
    const i = days.indexOf(dateKey(Date.now()))
    setWeek(i < 0 ? 0 : Math.floor(i / 7))
  }, [planId]) // eslint-disable-line react-hooks/exhaustive-deps

  const edit = (fn: () => void) => {
    fn()
    setDirty(true)
    if (plan) setFeedback({ message: 'Save your changes to update the timetable.' })
  }

  const generate = (preferences = prefs) => {
    try {
      const courses = normalizeCourses(draft)
      const semesterName = name.trim() || 'Current semester'
      const next = generateStudyPlan({ courses, preferences, semesterId: study.semesterId, semesterName, revision: (plan?.revision || 0) + 1 })
      const ids = new Set(next.sessions.map((s) => s.id))
      setStudy((prev) => ({
        ...prev,
        courses,
        semesterName,
        preferences: next.preferences,
        plan: next,
        notifications: prev.notifications.filter((n) => ids.has(n.sessionId)),
      }))
      setDirty(false)
      setFeedback({
        message: storageAvailable()
          ? `Your month is ready: ${plural(next.sessions.length, 'study block')} shared across ${plural(courses.length, 'course')}.`
          : 'Your timetable is ready for this visit. This browser isn’t letting the page save.',
      })
    } catch (e) {
      setFeedback({ message: (e as Error).message, error: true })
    }
  }

  const importCourses = (text: string) => {
    const incoming = parseCourseCSV(text)
    const rows = filled(draft).map((c) => ({ ...c }))
    for (const c of incoming) {
      const existing = rows.find((r) => r.code && courseKey(r.code) === courseKey(c.code))
      if (existing) existing.title = c.title
      else rows.push(c)
    }
    edit(() => setDraft(rows))
    setFeedback({ message: `Imported ${plural(incoming.length, 'course')}. Check the list, then create your timetable.` })
  }

  const count = filled(draft).length
  const tz = plan?.timeZone
  const time = (t: number) => new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZone: tz }).format(t)
  const weekDays = days.slice(week * 7, week * 7 + 7)
  const courseIndex = (id: string) => Math.max(0, study.courses.findIndex((c) => c.id === id))
  const ended = plan ? now >= new Date(`${plan.endDate}T00:00:00`).getTime() : false

  const startBlock = (id: string) => {
    const s = plan?.sessions.find((x) => x.id === id)
    if (!s) return
    if (startFocus({ minutes: s.minutes, task: `${s.code} · ${s.title}` })) {
      setStudy((prev) => ({ ...prev, notifications: prev.notifications.map((n) => (n.sessionId === id ? { ...n, read: true } : n)) }))
    }
  }

  return (
    <>
      <TabHero
        index="01"
        label="Timetable"
        title={['Your semester,', 'organised.']}
        intro="Add your courses and the hours you have. You get a month of study blocks, shared evenly, with 15-minute breaks between them."
        actions={
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => {
              setNewName('')
              setDialog('semester')
            }}
          >
            New semester
          </button>
        }
      />

      <div className="wrap sd-grid">
        <form
          className="sd-panel sd-span-5"
          onSubmit={(e) => {
            e.preventDefault()
            generate()
          }}
          aria-label="Courses and study hours"
        >
          <div className="sd-row-between">
            <h2 className="sd-panel-title">Your courses</h2>
            <span className="mono sd-muted">{plural(count, 'course')}</span>
          </div>
          <Field label="Semester" htmlFor="sd-sem">
            <input id="sd-sem" className="sd-input" maxLength={60} value={name} onChange={(e) => edit(() => setName(e.target.value))} />
          </Field>
          <div className="sd-inline sd-wrap">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => fileRef.current?.click()}>
              Upload CSV
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => {
                setPasteError('')
                setDialog('paste')
              }}
            >
              Paste a list
            </button>
            <button
              type="button"
              className="btn-text"
              onClick={() =>
                downloadFile(
                  createCoursesCSV([
                    { id: '1', code: 'MTH 101', title: 'Elementary Mathematics' },
                    { id: '2', code: 'PHY 101', title: 'General Physics' },
                    { id: '3', code: 'CHM 101', title: 'General Chemistry' },
                  ]),
                  'course-template.csv',
                  'text/csv;charset=utf-8',
                )
              }
            >
              CSV template
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.tsv,text/csv,text/tab-separated-values"
              hidden
              onChange={async (e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (!file) return
                try {
                  if (!/\.(csv|tsv)$/i.test(file.name)) throw new Error('Choose a CSV or TSV file with course codes and titles.')
                  importCourses(await file.text())
                } catch (err) {
                  setFeedback({ message: (err as Error).message, error: true })
                }
              }}
            />
          </div>

          <div className="sd-course-head mono sd-muted" aria-hidden>
            <span>Code</span>
            <span>Title</span>
          </div>
          <div className="sd-course-rows">
            {draft.map((c, i) => (
              <div key={c.id} className="sd-course-row">
                <input
                  className="sd-input"
                  placeholder="MTH 101"
                  maxLength={30}
                  aria-label={`Course code ${i + 1}`}
                  value={c.code}
                  onChange={(e) => edit(() => setDraft((d) => d.map((x) => (x.id === c.id ? { ...x, code: e.target.value } : x))))}
                />
                <input
                  className="sd-input"
                  placeholder="Course title"
                  maxLength={160}
                  aria-label={`Course title ${i + 1}`}
                  value={c.title}
                  onChange={(e) => edit(() => setDraft((d) => d.map((x) => (x.id === c.id ? { ...x, title: e.target.value } : x))))}
                />
                <button
                  type="button"
                  className="sd-icon-btn"
                  aria-label={`Remove course ${i + 1}`}
                  onClick={() => edit(() => setDraft((d) => (d.length > 1 ? d.filter((x) => x.id !== c.id) : [blank()])))}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <div className="sd-row-between">
            <button type="button" className="btn-text" onClick={() => setDraft((d) => [...d, blank()])}>
              <Plus /> Add a course
            </button>
            {count > 0 && (
              <button
                type="button"
                className="btn-text"
                onClick={() => {
                  try {
                    downloadFile(createCoursesCSV(normalizeCourses(draft)), 'my-courses.csv', 'text/csv;charset=utf-8')
                  } catch (err) {
                    setFeedback({ message: (err as Error).message, error: true })
                  }
                }}
              >
                Export list
              </button>
            )}
          </div>

          <div className="sd-rule" />
          <h2 className="sd-panel-title">Your study hours</h2>
          <div className="sd-two">
            <Field label="Start date" htmlFor="sd-start">
              <input id="sd-start" type="date" className="sd-input" value={prefs.startDate} onChange={(e) => edit(() => setPrefs((p) => ({ ...p, startDate: e.target.value })))} />
            </Field>
            <Field label="Block length" htmlFor="sd-block">
              <select id="sd-block" className="sd-input" value={prefs.minutes} onChange={(e) => edit(() => setPrefs((p) => ({ ...p, minutes: Number(e.target.value) })))}>
                {BLOCK_MINUTES.map((m) => (
                  <option key={m} value={m}>
                    {m} minutes
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Study days">
            <Segmented
              label="Study days"
              options={DAYS}
              value={prefs.days}
              onChange={(d) => edit(() => setPrefs((p) => ({ ...p, days: p.days.includes(d) ? p.days.filter((x) => x !== d) : [...p.days, d] })))}
            />
          </Field>
          <div className="sd-two">
            <Field label="From" htmlFor="sd-from">
              <input id="sd-from" type="time" className="sd-input" value={prefs.startTime} onChange={(e) => edit(() => setPrefs((p) => ({ ...p, startTime: e.target.value })))} />
            </Field>
            <Field label="Until" htmlFor="sd-until">
              <input id="sd-until" type="time" className="sd-input" value={prefs.endTime} onChange={(e) => edit(() => setPrefs((p) => ({ ...p, endTime: e.target.value })))} />
            </Field>
          </div>
          <Field label="Remind me" htmlFor="sd-remind">
            <select
              id="sd-remind"
              className="sd-input"
              value={prefs.reminderMinutes}
              onChange={(e) => edit(() => setPrefs((p) => ({ ...p, reminderMinutes: Number(e.target.value) })))}
            >
              {REMINDER_MINUTES.map((m) => (
                <option key={m} value={m}>
                  {m ? `${m} minutes before` : 'When the block starts'}
                </option>
              ))}
            </select>
          </Field>
          <p className="sd-muted sd-small">Courses rotate evenly for one calendar month. Times use this device’s time zone.</p>
          <Feedback message={feedback.message} error={feedback.error} />
          <button type="submit" className="btn btn-primary sd-full">
            {plan ? 'Save and update timetable' : 'Create my timetable'} <Arrow />
          </button>
        </form>

        <section className="sd-panel sd-span-7 sd-plan" aria-label="Study timetable">
          {!plan ? (
            <div className="sd-empty sd-empty-tall">
              <p className="display sd-empty-title">A month, planned.</p>
              <p className="sd-muted">Add your course codes and titles, choose your days and hours, and your timetable appears here.</p>
            </div>
          ) : (
            <>
              <div className="sd-row-between sd-wrap">
                <div>
                  <p className="mono sd-muted">{plan.semesterName}</p>
                  <h2 className="sd-panel-title">
                    {shortDay(plan.startDate)} – {shortDay(days.at(-1)!, true)}
                  </h2>
                </div>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => {
                  try {
                    downloadFile(createCalendarFile(plan, study.preferences.reminderMinutes, `${location.origin}/study`), `study-timetable-${plan.startDate}.ics`, 'text/calendar;charset=utf-8')
                    setDialog('calendar')
                  } catch (err) {
                    setFeedback({ message: (err as Error).message, error: true })
                  }
                }}>
                  Add to calendar
                </button>
              </div>
              <dl className="sd-stats sd-stats-plan">
                <div className="sd-stat">
                  <dt className="mono sd-muted">Courses</dt>
                  <dd className="display">{new Set(plan.sessions.map((s) => s.courseId)).size}</dd>
                </div>
                <div className="sd-stat">
                  <dt className="mono sd-muted">Blocks</dt>
                  <dd className="display">{plan.sessions.length}</dd>
                </div>
                <div className="sd-stat">
                  <dt className="mono sd-muted">Hours</dt>
                  <dd className="display">
                    {new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(plan.sessions.reduce((sum, s) => sum + s.minutes, 0) / 60)}
                  </dd>
                </div>
              </dl>
              {ended && (
                <div className="sd-confirm">
                  <p>This month’s plan has finished. Plan the next month from today with the same courses and hours.</p>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      const next = { ...prefs, startDate: dateKey(Date.now()) }
                      setPrefs(next)
                      generate(next)
                    }}
                  >
                    Plan another month
                  </button>
                </div>
              )}
              <div className="sd-row-between sd-week-nav">
                <button type="button" className="sd-icon-btn" aria-label="Previous week" disabled={week === 0} onClick={() => setWeek((w) => w - 1)}>
                  <Arrow dir="left" />
                </button>
                <p>
                  <strong>
                    Week {week + 1} of {weeks}
                  </strong>{' '}
                  <span className="mono sd-muted">
                    {weekDays.length ? `${shortDay(weekDays[0])} – ${shortDay(weekDays.at(-1)!)}` : ''}
                  </span>
                </p>
                <button type="button" className="sd-icon-btn" aria-label="Next week" disabled={week >= weeks - 1} onClick={() => setWeek((w) => w + 1)}>
                  <Arrow />
                </button>
              </div>
              <div className="sd-week" key={`${planId}-${week}`}>
                {weekDays.map((key) => {
                  const blocks = plan.sessions.filter((s) => s.date === key)
                  return (
                    <section key={key} className="sd-day" data-today={key === dateKey(now) || undefined}>
                      <div className="sd-day-head">
                        <strong>{new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(new Date(`${key}T12:00:00`))}</strong>
                        <span className="mono sd-muted">{shortDay(key)}</span>
                      </div>
                      {blocks.length ? (
                        blocks.map((s) => (
                          <article key={s.id} className="sd-block" data-tone={courseIndex(s.courseId) % 4}>
                            <div className="sd-row-between">
                              <strong className="mono">{s.code}</strong>
                              <span className="mono sd-muted">
                                {time(s.startAt)} – {time(s.endAt)}
                              </span>
                            </div>
                            <p>{s.title}</p>
                            <button type="button" className="btn-text" onClick={() => startBlock(s.id)} aria-label={`Study ${s.code} for ${s.minutes} minutes`}>
                              Study {s.minutes} min <Arrow />
                            </button>
                          </article>
                        ))
                      ) : (
                        <p className="sd-muted sd-small">Rest day</p>
                      )}
                    </section>
                  )
                })}
              </div>
              <p className="mono sd-muted sd-small">Times in {plan.timeZone.replace(/_/g, ' ')} · 15-minute breaks between blocks</p>
            </>
          )}
        </section>
      </div>

      <Dialog
        open={dialog === 'paste'}
        onClose={() => setDialog(null)}
        eyebrow="Import"
        title="Paste your course list"
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              try {
                importCourses(pasted)
                setPasted('')
                setDialog(null)
              } catch (err) {
                setPasteError((err as Error).message)
              }
            }}
          >
            Add to my list
          </button>
        }
      >
        <p className="sd-muted">One course per line, with a comma or tab between the code and the title. Rows copied from a spreadsheet work too.</p>
        <textarea
          className="sd-input sd-textarea"
          rows={8}
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          placeholder={'MTH 101, Elementary Mathematics\nPHY 101, General Physics'}
          aria-label="Course codes and titles"
        />
        <Feedback message={pasteError} error />
      </Dialog>

      <Dialog
        open={dialog === 'semester'}
        onClose={() => setDialog(null)}
        eyebrow="Fresh start"
        title="Begin a new semester?"
        actions={
          <>
            <button type="button" className="btn-text" onClick={() => setDialog(null)}>
              Keep current
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                const next = initialStudyState()
                next.semesterName = newName.trim() || 'New semester'
                next.remindersEnabled = study.remindersEnabled
                setStudy(next)
                setDirty(false)
                setDraft(blanks())
                setFeedback({ message: 'Your new semester is ready. Add your courses to create its timetable.' })
                setDialog(null)
              }}
            >
              Start fresh
            </button>
          </>
        }
      >
        <p className="sd-muted">This replaces your course list and timetable. Export your course list first if you want a copy.</p>
        <Field label="New semester name" htmlFor="sd-new-sem">
          <input id="sd-new-sem" className="sd-input" maxLength={60} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Harmattan semester" />
        </Field>
      </Dialog>

      <Dialog
        open={dialog === 'calendar'}
        onClose={() => setDialog(null)}
        eyebrow="Downloaded"
        title="Your month, in your calendar"
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setDialog(null)}>
            Got it
          </button>
        }
      >
        <ol className="sd-steps">
          <li>
            <span className="mono sd-muted">01</span>
            <div>
              <strong>Apple Calendar or Outlook</strong>
              <p>Open the downloaded .ics file and approve adding its study blocks.</p>
            </div>
          </li>
          <li>
            <span className="mono sd-muted">02</span>
            <div>
              <strong>Google Calendar</strong>
              <p>
                On a computer, open Calendar settings, choose Import &amp; export, pick the .ics file and import it into a separate study calendar.{' '}
                <a className="link" href="https://support.google.com/calendar/answer/37118" target="_blank" rel="noreferrer">
                  Google’s instructions
                </a>
              </p>
            </div>
          </li>
          <li>
            <span className="mono sd-muted">03</span>
            <div>
              <strong>Check your alerts</strong>
              <p>The file is a snapshot. If you change your plan, delete that study calendar and import the new file.</p>
            </div>
          </li>
        </ol>
      </Dialog>
    </>
  )
}
