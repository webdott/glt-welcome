// Focus timer state. Ported from Focus Garden's timer-core; storage key kept so
// anyone who used the original on this device keeps their garden.
export const STORAGE_KEY = 'focus-garden-v1'

export const DAILY_GOALS = [30, 60, 90, 120, 180] as const

export type Session = { id: string; task: string; minutes: number; completedAt: number }

export type ActiveSession = {
  id: string
  mode: 'focus' | 'break'
  task: string
  status: 'running' | 'paused'
  durationMs: number
  remainingMs: number
  startedAt: number
  endAt: number
}

export type TimerState = {
  version: 1
  settings: { dailyGoal: number; soundEnabled: boolean }
  activeSession: ActiveSession | null
  sessions: Session[]
}

export function initialState(): TimerState {
  return { version: 1, settings: { dailyGoal: 60, soundEnabled: true }, activeSession: null, sessions: [] }
}

export function normalizeState(value: any): TimerState {
  const state = initialState()
  if (!value || value.version !== 1) return state
  if ((DAILY_GOALS as readonly number[]).includes(value.settings?.dailyGoal)) state.settings.dailyGoal = value.settings.dailyGoal
  state.settings.soundEnabled = value.settings?.soundEnabled !== false
  if (Array.isArray(value.sessions)) {
    const seen = new Set<string>()
    state.sessions = value.sessions
      .filter((s: any) => {
        const valid =
          s &&
          typeof s.id === 'string' &&
          typeof s.task === 'string' &&
          Number.isFinite(s.completedAt) &&
          Number.isInteger(s.minutes) &&
          s.minutes >= 1 &&
          s.minutes <= 180 &&
          !seen.has(s.id)
        if (valid) seen.add(s.id)
        return valid
      })
      .map((s: Session) => ({ ...s, task: s.task.slice(0, 80) }))
  }
  const a = value.activeSession
  if (
    a &&
    typeof a.id === 'string' &&
    ['focus', 'break'].includes(a.mode) &&
    ['running', 'paused'].includes(a.status) &&
    Number.isFinite(a.durationMs) &&
    a.durationMs >= 60000 &&
    a.durationMs <= 10800000 &&
    Number.isFinite(a.remainingMs) &&
    a.remainingMs >= 0 &&
    a.remainingMs <= a.durationMs &&
    Number.isFinite(a.endAt) &&
    Number.isFinite(a.startedAt)
  ) {
    state.activeSession = { ...a, task: String(a.task || 'Focused study').slice(0, 80) }
  }
  return state
}

export function remainingMs(session: ActiveSession | null, now = Date.now()) {
  if (!session) return 0
  return Math.max(0, session.status === 'running' ? session.endAt - now : session.remainingMs)
}

export function startSession(
  state: TimerState,
  { id, minutes, task, mode = 'focus', now = Date.now() }: { id: string; minutes: number; task: string; mode?: 'focus' | 'break'; now?: number },
): TimerState {
  if (state.activeSession) return state
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 180) {
    throw new RangeError('Choose a duration between 1 and 180 minutes.')
  }
  const durationMs = minutes * 60000
  return {
    ...state,
    activeSession: {
      id,
      mode,
      task: String(task || 'Focused study').trim().slice(0, 80) || 'Focused study',
      status: 'running',
      durationMs,
      remainingMs: durationMs,
      startedAt: now,
      endAt: now + durationMs,
    },
  }
}

export function completeIfDue(state: TimerState, now = Date.now()): TimerState {
  const a = state.activeSession
  if (!a || a.status !== 'running' || remainingMs(a, now) > 0) return state
  let sessions = state.sessions
  if (a.mode === 'focus' && !sessions.some((s) => s.id === a.id)) {
    sessions = [...sessions, { id: a.id, task: a.task, minutes: Math.round(a.durationMs / 60000), completedAt: a.endAt }]
  }
  return { ...state, activeSession: null, sessions }
}

export function pauseSession(state: TimerState, now = Date.now()): TimerState {
  const settled = completeIfDue(state, now)
  const a = settled.activeSession
  if (!a || a.status !== 'running') return settled
  return { ...settled, activeSession: { ...a, status: 'paused', remainingMs: remainingMs(a, now) } }
}

export function resumeSession(state: TimerState, now = Date.now()): TimerState {
  const a = state.activeSession
  if (!a || a.status !== 'paused') return state
  return { ...state, activeSession: { ...a, status: 'running', endAt: now + a.remainingMs } }
}

export function localDayKey(timestamp: number) {
  const d = new Date(timestamp)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Consecutive days with a finished session, counting today only once something is done today. */
export function streakDays(sessions: Session[], now = Date.now()) {
  const days = new Set(sessions.map((s) => localDayKey(s.completedAt)))
  const cursor = new Date(now)
  cursor.setHours(12, 0, 0, 0)
  if (!days.has(localDayKey(cursor.getTime()))) cursor.setDate(cursor.getDate() - 1)
  let streak = 0
  while (days.has(localDayKey(cursor.getTime()))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export function minutesOn(sessions: Session[], day: string) {
  return sessions.filter((s) => localDayKey(s.completedAt) === day).reduce((sum, s) => sum + s.minutes, 0)
}
