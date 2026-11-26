import { useEffect, useRef, useState } from 'react'
import { animate } from 'motion/react'
import {
  CGPA_STORAGE_KEY,
  OAU_GRADES,
  blankCgpaCourse,
  blankCgpaSemester,
  calculateCgpa,
  copyCgpaCourses,
  courseCreditPoints,
  hasCgpaEntry,
  initialCgpaState,
  normalizeCgpaState,
} from '../cgpa'
import type { CgpaCourse, CgpaProblem, CgpaSemester, CgpaState } from '../cgpa'
import { Plus } from '../../components/icons'
import { useStudy } from './context'
import { Dialog, Feedback, Field } from './primitives'
import { plural, useStored } from './stored'
import { TabHero } from './TabHero'

export function CgpaTab() {
  const { study, go } = useStudy()
  const [state, setState] = useStored(CGPA_STORAGE_KEY, normalizeCgpaState, initialCgpaState)
  const [feedback, setFeedback] = useState<{ message: string; error?: boolean }>({ message: '' })
  const [problems, setProblems] = useState<CgpaProblem[]>([])
  const [removed, setRemoved] = useState<{ semesterId: string; index: number; course: CgpaCourse } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const resultRef = useRef<HTMLElement>(null)

  const semester = state.semesters.find((s) => s.id === state.selectedSemesterId) ?? state.semesters[0]
  const result = state.calculated ? calculateCgpa(state.semesters) : null
  const valid = result && result.ok && 'semesters' in result ? result : null
  const currentGpa = valid?.semesters.find((s) => s.id === semester.id)?.gpa

  const reset = () => {
    setProblems([])
    setFeedback({ message: '' })
  }
  // Any edit invalidates the last calculation.
  const change = (fn: (s: CgpaState) => CgpaState, keepResult = false) => setState((s) => ({ ...fn(s), calculated: keepResult ? s.calculated : false }))
  const updateSemester = (fn: (s: CgpaSemester) => CgpaSemester) =>
    change((st) => ({ ...st, semesters: st.semesters.map((s) => (s.id === semester.id ? fn(s) : s)) }))
  const updateCourse = (id: string, field: keyof CgpaCourse, value: string) => {
    reset()
    updateSemester((s) => ({ ...s, courses: s.courses.map((c) => (c.id === id ? { ...c, [field]: value } : c)) }))
  }
  const invalid = (courseId: string, field: CgpaProblem['field']) => problems.some((p) => p.courseId === courseId && p.field === field)

  const calculate = () => {
    reset()
    setRemoved(null)
    const r = calculateCgpa(state.semesters)
    setState((s) => ({ ...s, calculated: r.ok }))
    if ('empty' in r && r.empty) {
      setFeedback({ message: 'Add at least one course code, its units and final grade to calculate.', error: true })
      return
    }
    if (!r.ok) {
      setProblems(r.problems)
      setState((s) => ({ ...s, selectedSemesterId: r.problems[0].semesterId }))
      return
    }
    setFeedback({ message: 'Calculated. Every semester you entered is included.' })
    requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
  }

  const copyFromTimetable = () => {
    try {
      if (!study.courses.length) throw new Error('Save some courses in the Timetable tab first, or type them in here.')
      const copied = copyCgpaCourses(semester, study.courses)
      if (!copied.added) {
        setFeedback({ message: 'Those courses are already in this semester. Your units and grades are unchanged.' })
        return
      }
      updateSemester((s) => ({
        ...s,
        name: !s.courses.some(hasCgpaEntry) && study.semesterName ? study.semesterName.slice(0, 60) : s.name,
        courses: copied.courses,
      }))
      setFeedback({ message: `${plural(copied.added, 'course')} copied. Add the units and final grades from your results.` })
    } catch (e) {
      setFeedback({ message: (e as Error).message, error: true })
    }
  }

  return (
    <>
      <TabHero
        index="02"
        label="CGPA"
        title={['Know where', 'you stand.']}
        intro="Enter each semester’s units and final grades on OAU’s 5-point scale. Failed courses count towards your total units, as the regulations require."
      />

      <div className="wrap sd-grid">
        <section className="sd-panel sd-span-7" aria-label="Results by semester">
          <div className="sd-sem-tabs" role="group" aria-label="Semesters">
            {state.semesters.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={s.id === semester.id}
                onClick={() => {
                  reset()
                  setRemoved(null)
                  change((st) => ({ ...st, selectedSemesterId: s.id }), true)
                }}
              >
                {s.name.trim() || `Semester ${i + 1}`}
              </button>
            ))}
            <button
              type="button"
              className="sd-sem-add"
              disabled={state.semesters.length >= 40}
              onClick={() => {
                reset()
                setRemoved(null)
                const next = blankCgpaSemester(`Semester ${state.semesters.length + 1}`)
                change((st) => ({ ...st, semesters: [...st.semesters, next], selectedSemesterId: next.id }))
              }}
            >
              <Plus /> Semester
            </button>
          </div>

          <div className="sd-two sd-cgpa-meta">
            <Field label="Semester name" htmlFor="sd-cgpa-sem">
              <input
                id="sd-cgpa-sem"
                className="sd-input"
                maxLength={60}
                value={semester.name}
                onChange={(e) => {
                  reset()
                  updateSemester((s) => ({ ...s, name: e.target.value }))
                }}
              />
            </Field>
            <div className="sd-field sd-field-end">
              <button type="button" className="btn btn-outline btn-sm" onClick={copyFromTimetable}>
                Copy courses from timetable
              </button>
            </div>
          </div>

          <div className="sd-cgpa-head mono sd-muted" aria-hidden>
            <span>Course</span>
            <span>Units</span>
            <span>Grade</span>
            <span>Points</span>
            <span />
          </div>
          <div className="sd-cgpa-rows">
            {semester.courses.map((c, i) => (
              <div key={c.id} className="sd-cgpa-row">
                <div className="sd-cgpa-course">
                  <input
                    className="sd-input"
                    placeholder="MTH 101"
                    maxLength={30}
                    aria-label={`Course code ${i + 1}`}
                    aria-invalid={invalid(c.id, 'code') || undefined}
                    value={c.code}
                    onChange={(e) => updateCourse(c.id, 'code', e.target.value)}
                  />
                  <input
                    className="sd-input sd-input-quiet"
                    placeholder="Title (optional)"
                    maxLength={160}
                    aria-label={`Course title ${i + 1}, optional`}
                    value={c.title}
                    onChange={(e) => updateCourse(c.id, 'title', e.target.value)}
                  />
                </div>
                <input
                  className="sd-input"
                  type="number"
                  min={1}
                  max={99}
                  step={1}
                  inputMode="numeric"
                  placeholder="3"
                  aria-label={`Units for course ${i + 1}`}
                  aria-invalid={invalid(c.id, 'units') || undefined}
                  value={c.units}
                  onChange={(e) => updateCourse(c.id, 'units', e.target.value)}
                />
                <select
                  className="sd-input"
                  aria-label={`Grade for course ${i + 1}`}
                  aria-invalid={invalid(c.id, 'grade') || undefined}
                  value={c.grade}
                  onChange={(e) => updateCourse(c.id, 'grade', e.target.value)}
                >
                  <option value="">–</option>
                  {OAU_GRADES.map((g) => (
                    <option key={g.letter} value={g.letter}>
                      {g.letter} · {g.points}
                    </option>
                  ))}
                </select>
                <output className="mono" aria-label={`Credit points for course ${i + 1}`}>
                  {courseCreditPoints(c) ?? '—'}
                </output>
                <button
                  type="button"
                  className="sd-icon-btn"
                  aria-label={`Remove course ${i + 1}`}
                  onClick={() => {
                    reset()
                    setRemoved({ semesterId: semester.id, index: i, course: c })
                    updateSemester((s) => {
                      const courses = s.courses.filter((x) => x.id !== c.id)
                      return { ...s, courses: courses.length ? courses : [blankCgpaCourse()] }
                    })
                    setFeedback({ message: 'Course removed.' })
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="sd-row-between sd-wrap">
            <div className="sd-inline">
              <button
                type="button"
                className="btn-text"
                disabled={semester.courses.length >= 100}
                onClick={() => {
                  reset()
                  setRemoved(null)
                  updateSemester((s) => ({ ...s, courses: [...s.courses, blankCgpaCourse()] }))
                }}
              >
                <Plus /> Add a course
              </button>
              {removed && (
                <button
                  type="button"
                  className="btn-text"
                  onClick={() => {
                    const r = removed
                    setRemoved(null)
                    change((st) => ({
                      ...st,
                      semesters: st.semesters.map((s) => {
                        if (s.id !== r.semesterId) return s
                        const courses = s.courses.length === 1 && !hasCgpaEntry(s.courses[0]) ? [] : [...s.courses]
                        courses.splice(r.index, 0, r.course)
                        return { ...s, courses }
                      }),
                    }))
                    setFeedback({ message: 'Course restored.' })
                  }}
                >
                  Undo removal
                </button>
              )}
            </div>
            <button type="button" className="btn-text sd-danger" onClick={() => setConfirmDelete(true)}>
              Remove semester
            </button>
          </div>

          {problems.length > 0 && (
            <div className="sd-errors" role="alert">
              <strong>Complete these to calculate:</strong>
              <ul>
                {problems.map((p) => (
                  <li key={`${p.courseId}-${p.field}`}>{p.message}</li>
                ))}
              </ul>
            </div>
          )}
          <Feedback message={feedback.message} error={feedback.error} />
          <button type="button" className="btn btn-primary sd-full" onClick={calculate}>
            Calculate my CGPA
          </button>
        </section>

        <aside ref={resultRef} className="sd-panel sd-span-5 sd-result" aria-live="polite" aria-label="CGPA result" tabIndex={-1}>
          <p className="mono sd-muted">Cumulative GPA</p>
          <p className={`display sd-cgpa-value ${valid ? '' : 'is-empty'}`}>{valid ? <CountUp value={valid.cgpa!} /> : '—'}</p>
          <p className="sd-muted">
            {valid
              ? `${plural(valid.courseCount, 'course attempt')} across ${plural(valid.semesters.length, 'semester')}`
              : 'Enter your results, then calculate.'}
          </p>
          <p className="mono sd-small">
            {valid ? `${valid.creditPoints} credit points ÷ ${valid.units} units = ${valid.cgpa!.toFixed(2)}` : 'Every unit counts towards the average.'}
          </p>
          <p className="mono sd-muted sd-small">{currentGpa != null ? `This semester: ${currentGpa.toFixed(2)} GPA` : ''}</p>
          <div className="sd-rule" />
          {valid ? (
            <ul className="sd-list">
              {valid.semesters.map((s) => (
                <li key={s.id}>
                  <span>
                    <strong>{s.name}</strong>
                    <span className="sd-muted sd-small">
                      {' '}
                      · {s.creditPoints} points · {plural(s.units, 'unit')}
                    </span>
                  </span>
                  <span className="mono">{s.gpa!.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="sd-muted sd-small">Each semester’s GPA appears here.</p>
          )}
          <div className="sd-rule" />
          <table className="sd-grade-table">
            <caption className="mono sd-muted">OAU grading</caption>
            <tbody>
              {OAU_GRADES.map((g) => (
                <tr key={g.letter}>
                  <th scope="row">{g.letter}</th>
                  <td>{g.marks}</td>
                  <td className="mono">{g.points} pts</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="sd-small sd-muted">
            Source:{' '}
            <a className="link" href="https://eportal.oauife.edu.ng/downloads/ExaminationREgulations.pdf#page=24" target="_blank" rel="noreferrer">
              OAU Examination Regulations, §§17–18
            </a>
            . Your official transcript is what counts.
          </p>
          <button type="button" className="btn-text" onClick={() => go('timetable')}>
            Edit your course list
          </button>
        </aside>
      </div>

      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        eyebrow="Remove semester"
        title={`Remove ${semester.name.trim() || 'this semester'}?`}
        actions={
          <>
            <button type="button" className="btn-text" onClick={() => setConfirmDelete(false)}>
              Keep it
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                reset()
                setRemoved(null)
                change((st) => {
                  const semesters = st.semesters.filter((s) => s.id !== semester.id)
                  const next = semesters.length ? semesters : [blankCgpaSemester()]
                  return { ...st, semesters: next, selectedSemesterId: next[0].id }
                })
                setConfirmDelete(false)
                setFeedback({ message: 'Semester removed.' })
              }}
            >
              Remove semester
            </button>
          </>
        }
      >
        <p className="sd-muted">Its courses, units and grades will be deleted from this device.</p>
      </Dialog>
    </>
  )
}

/** Counts up to a new result; shows the value as-is on first render so revisiting the tab stays still. */
function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const controls = animate(0, value, {
      duration: 0.5,
      ease: [0.23, 1, 0.32, 1],
      onUpdate: (v) => {
        if (ref.current) ref.current.textContent = v.toFixed(2)
      },
    })
    return () => controls.stop()
  }, [value])
  return <span ref={ref}>{value.toFixed(2)}</span>
}
