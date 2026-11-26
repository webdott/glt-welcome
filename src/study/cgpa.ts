// OAU University Examination Regulations, sections 17(D) and 18(v)-(viii):
// https://eportal.oauife.edu.ng/downloads/ExaminationREgulations.pdf
export const CGPA_STORAGE_KEY = 'focus-garden-cgpa-v1'

export const OAU_GRADES = [
  { letter: 'A', marks: '70–100', points: 5 },
  { letter: 'B', marks: '60–69', points: 4 },
  { letter: 'C', marks: '50–59', points: 3 },
  { letter: 'D', marks: '45–49', points: 2 },
  { letter: 'E', marks: '40–44', points: 1 },
  { letter: 'F', marks: '0–39', points: 0 },
] as const

const gradePoints = new Map<string, number>(OAU_GRADES.map((g) => [g.letter, g.points]))

export type CgpaCourse = { id: string; code: string; title: string; units: string; grade: string }
export type CgpaSemester = { id: string; name: string; courses: CgpaCourse[] }
export type CgpaState = { version: 1; semesters: CgpaSemester[]; selectedSemesterId: string; calculated: boolean }

export type CgpaProblem = { semesterId: string; courseId: string; field: 'code' | 'units' | 'grade'; message: string }
export type SemesterSummary = { id: string; name: string; units: number; creditPoints: number; courseCount: number; gpa: number | null }
export type CgpaResult =
  | { ok: false; empty: false; problems: CgpaProblem[]; cgpa: null }
  | {
      ok: boolean
      empty: boolean
      problems: []
      semesters: SemesterSummary[]
      units: number
      creditPoints: number
      courseCount: number
      cgpa: number | null
    }

export const blankCgpaCourse = (): CgpaCourse => ({ id: crypto.randomUUID(), code: '', title: '', units: '', grade: '' })

export const blankCgpaSemester = (name = 'Semester 1'): CgpaSemester => ({
  id: crypto.randomUUID(),
  name,
  courses: [blankCgpaCourse(), blankCgpaCourse(), blankCgpaCourse()],
})

export function initialCgpaState(): CgpaState {
  const semester = blankCgpaSemester()
  return { version: 1, semesters: [semester], selectedSemesterId: semester.id, calculated: false }
}

export const hasCgpaEntry = (c: CgpaCourse) => (['code', 'title', 'units', 'grade'] as const).some((f) => String(c[f] ?? '').trim())

export function courseCreditPoints(c: CgpaCourse) {
  const units = Number(c.units)
  return Number.isInteger(units) && units > 0 && units <= 99 && gradePoints.has(c.grade) ? units * gradePoints.get(c.grade)! : null
}

export function normalizeCgpaState(value: any): CgpaState {
  if (!value || value.version !== 1 || !Array.isArray(value.semesters) || !value.semesters.length) return initialCgpaState()
  const ids = new Set<string>()
  const uniqueId = (candidate: unknown) => {
    let id = typeof candidate === 'string' && candidate.length < 100 ? candidate : crypto.randomUUID()
    if (ids.has(id)) id = crypto.randomUUID()
    ids.add(id)
    return id
  }
  const semesters: CgpaSemester[] = value.semesters.slice(0, 40).map((s: any, i: number) => ({
    id: uniqueId(s?.id),
    name: String(s?.name ?? `Semester ${i + 1}`).slice(0, 60),
    courses:
      Array.isArray(s?.courses) && s.courses.length
        ? s.courses.slice(0, 100).map((c: any) => ({
            id: uniqueId(c?.id),
            code: String(c?.code ?? '').slice(0, 30),
            title: String(c?.title ?? '').slice(0, 160),
            units: String(c?.units ?? '').slice(0, 10),
            grade: String(c?.grade ?? '').slice(0, 10),
          }))
        : [blankCgpaCourse()],
  }))
  return {
    version: 1,
    semesters,
    selectedSemesterId: semesters.some((s) => s.id === value.selectedSemesterId) ? value.selectedSemesterId : semesters[0].id,
    calculated: value.calculated === true,
  }
}

const codeKey = (code: string) => String(code || '').trim().toUpperCase().replace(/\s+/g, '')

export function calculateCgpa(semesters: CgpaSemester[]): CgpaResult {
  const problems: CgpaProblem[] = []
  const summaries: SemesterSummary[] = []
  for (const [si, semester] of semesters.entries()) {
    const name = semester.name.trim() || `Semester ${si + 1}`
    let units = 0
    let creditPoints = 0
    let courseCount = 0
    const codes = new Set<string>()
    for (const [index, course] of semester.courses.entries()) {
      if (!hasCgpaEntry(course)) continue
      courseCount++
      const label = `${name}, course ${index + 1}`
      const code = codeKey(course.code)
      const problem = (field: CgpaProblem['field'], message: string) =>
        problems.push({ semesterId: semester.id, courseId: course.id, field, message: `${label}: ${message}` })
      if (!code) problem('code', 'add a course code.')
      else if (codes.has(code)) problem('code', 'this course code already appears in this semester.')
      codes.add(code)
      const n = Number(course.units)
      const validUnits = String(course.units).trim() !== '' && Number.isInteger(n) && n > 0 && n <= 99
      if (!validUnits) problem('units', 'enter whole-number units from 1 to 99.')
      if (!gradePoints.has(course.grade)) problem('grade', 'choose the final grade, A to F.')
      if (validUnits && gradePoints.has(course.grade)) {
        units += n // Failed attempts count in the denominator.
        creditPoints += n * gradePoints.get(course.grade)!
      }
    }
    if (courseCount) summaries.push({ id: semester.id, name, units, creditPoints, courseCount, gpa: units ? creditPoints / units : null })
  }
  if (problems.length) return { ok: false, problems, empty: false, cgpa: null }
  const units = summaries.reduce((sum, s) => sum + s.units, 0)
  const creditPoints = summaries.reduce((sum, s) => sum + s.creditPoints, 0)
  return {
    ok: Boolean(units),
    empty: !units,
    problems: [],
    semesters: summaries,
    units,
    creditPoints,
    courseCount: summaries.reduce((sum, s) => sum + s.courseCount, 0),
    cgpa: units ? creditPoints / units : null,
  }
}

export function copyCgpaCourses(semester: CgpaSemester, courses: { code: string; title?: string }[]) {
  const existing = semester.courses.filter(hasCgpaEntry)
  const codes = new Set(existing.map((c) => codeKey(c.code)).filter(Boolean))
  const additions: CgpaCourse[] = []
  for (const c of courses) {
    if (!codeKey(c.code) || codes.has(codeKey(c.code))) continue
    codes.add(codeKey(c.code))
    additions.push({ ...blankCgpaCourse(), code: String(c.code).trim().toUpperCase().slice(0, 30), title: String(c.title || '').slice(0, 160) })
  }
  if (existing.length + additions.length > 100) throw new Error('Keep up to 100 courses in each semester.')
  return { courses: [...existing, ...additions], added: additions.length }
}
