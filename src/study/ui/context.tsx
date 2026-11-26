import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  STORAGE_KEY,
  completeIfDue,
  initialState,
  normalizeState,
  pauseSession,
  remainingMs,
  resumeSession,
  startSession,
} from '../timer'
import type { ActiveSession, TimerState } from '../timer'
import { STUDY_STORAGE_KEY, dueReminders, initialStudyState, normalizeStudyState } from '../plan'
import type { StudyState } from '../plan'
import { completionRewards } from '../streak'
import { createSessionSound } from '../sound'
import { useStored } from './stored'

export const TABS = ['timetable', 'cgpa', 'focus', 'buddy', 'progress'] as const
export type Tab = (typeof TABS)[number]

type Completion = { session: ActiveSession; rewards: ReturnType<typeof completionRewards> }

type StudyContext = {
  tab: Tab
  go: (tab: Tab) => void
  toast: (message: string) => void
  timer: TimerState
  setTimer: (next: TimerState | ((prev: TimerState) => TimerState)) => void
  now: number
  sound: ReturnType<typeof createSessionSound>
  unlockSound: () => void
  toggleTimer: (opts: { minutes: number; task: string }) => void
  endSession: () => void
  startFocus: (opts: { minutes: number; task: string }) => boolean
  startBreak: () => void
  completion: Completion | null
  closeCompletion: () => void
  study: StudyState
  setStudy: (next: StudyState | ((prev: StudyState) => StudyState)) => void
}

const Ctx = createContext<StudyContext | null>(null)

export function useStudy() {
  const value = useContext(Ctx)
  if (!value) throw new Error('useStudy must be used inside StudyProvider')
  return value
}

export function StudyProvider({ tab, children }: { tab: Tab; children: ReactNode }) {
  const navigate = useNavigate()
  const [timer, setTimer] = useStored(STORAGE_KEY, normalizeState, initialState)
  const [study, setStudy] = useStored(STUDY_STORAGE_KEY, normalizeStudyState, () => initialStudyState())
  const [now, setNow] = useState(() => Date.now())
  const [toastState, setToastState] = useState<{ id: number; message: string } | null>(null)
  const [completion, setCompletion] = useState<Completion | null>(null)
  const sound = useMemo(() => createSessionSound(), [])
  const timerRef = useRef(timer)
  timerRef.current = timer

  const go = useCallback((next: Tab) => navigate({ to: '/study', search: { tab: next } }), [navigate])

  const toast = useCallback((message: string) => setToastState({ id: Date.now(), message }), [])
  useEffect(() => {
    if (!toastState) return
    const t = setTimeout(() => setToastState(null), 4200)
    return () => clearTimeout(t)
  }, [toastState])

  const unlockSound = useCallback(() => {
    if (timerRef.current.settings.soundEnabled) void sound.unlock()
  }, [sound])

  // Finish a session whose time has run out: record it, ring, and show what it earned.
  const settle = useCallback(() => {
    const latest = timerRef.current
    const active = latest.activeSession
    const next = completeIfDue(latest)
    if (next === latest || !active) return false
    setTimer(next)
    sound.stop()
    setCompletion({ session: active, rewards: active.mode === 'focus' ? completionRewards(next.sessions, active.id) : null })
    if (latest.settings.soundEnabled) sound.play()
    return true
  }, [setTimer, sound])

  useEffect(() => {
    const running = timer.activeSession?.status === 'running'
    const id = setInterval(() => {
      if (running && remainingMs(timerRef.current.activeSession) <= 0) settle()
      setNow(Date.now())
    }, running ? 250 : 30000)
    return () => clearInterval(id)
  }, [timer.activeSession?.status, settle])

  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden) {
        settle()
        setNow(Date.now())
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('pagehide', sound.stop)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('pagehide', sound.stop)
    }
  }, [settle, sound])

  // Keep the tab title useful while a timer runs.
  useEffect(() => {
    const a = timer.activeSession
    if (!a) {
      document.title = 'Study space · GLT Ile-Ife'
      return
    }
    const s = Math.ceil(remainingMs(a, now) / 1000)
    const clock = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
    document.title = `${clock} · ${a.status === 'paused' ? 'Paused' : a.mode === 'break' ? 'Break' : 'Focusing'} · Study space`
  }, [timer.activeSession, now])

  const startFocus = useCallback(
    ({ minutes, task }: { minutes: number; task: string }) => {
      settle()
      go('focus')
      if (completeIfDue(timerRef.current).activeSession) {
        toast('A session is already running. Finish or end it before starting another.')
        return false
      }
      unlockSound()
      setTimer((t) => startSession(t, { id: crypto.randomUUID(), minutes, task: task.slice(0, 80) }))
      return true
    },
    [go, settle, setTimer, toast, unlockSound],
  )

  const toggleTimer = useCallback(
    ({ minutes, task }: { minutes: number; task: string }) => {
      if (settle()) return
      sound.stop()
      unlockSound()
      const a = timerRef.current.activeSession
      if (a) {
        setTimer((t) => (a.status === 'running' ? pauseSession(t) : resumeSession(t)))
        return
      }
      if (!Number.isInteger(minutes) || minutes < 1 || minutes > 180) {
        toast('Choose a whole number between 1 and 180 minutes.')
        return
      }
      setTimer((t) => startSession(t, { id: crypto.randomUUID(), minutes, task: task || 'Focused study' }))
    },
    [settle, setTimer, sound, toast, unlockSound],
  )

  const endSession = useCallback(() => {
    if (settle()) return
    const wasBreak = timerRef.current.activeSession?.mode === 'break'
    setTimer((t) => ({ ...t, activeSession: null }))
    toast(wasBreak ? 'Break finished. Ready when you are.' : 'Session ended. Start again whenever you’re ready.')
  }, [settle, setTimer, toast])

  const startBreak = useCallback(() => {
    setCompletion(null)
    sound.stop()
    go('focus')
    if (timerRef.current.activeSession) return
    unlockSound()
    setTimer((t) => startSession(t, { id: crypto.randomUUID(), minutes: 5, task: 'Short break', mode: 'break' }))
  }, [go, setTimer, sound, unlockSound])

  const closeCompletion = useCallback(() => {
    setCompletion(null)
    sound.stop()
  }, [sound])

  // Study reminders: raise any that have come due, every 15 seconds and when the tab returns.
  const studyRef = useRef(study)
  studyRef.current = study
  useEffect(() => {
    const poll = () => {
      const s = studyRef.current
      if (!s.remindersEnabled || !s.plan) return
      const additions = dueReminders(s.plan, s.notifications, s.preferences.reminderMinutes)
      if (!additions.length) return
      setStudy((prev) => ({ ...prev, notifications: [...prev.notifications, ...additions] }))
      const last = additions.at(-1)!
      const session = s.plan.sessions.find((x) => x.id === last.sessionId)
      if (session) toast(`${last.type === 'upcoming' ? 'Coming up' : 'Time to study'} · ${session.code}`)
    }
    poll()
    const id = setInterval(poll, 15000)
    const onVisible = () => !document.hidden && poll()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [setStudy, toast])

  const value: StudyContext = {
    tab,
    go,
    toast,
    timer,
    setTimer,
    now,
    sound,
    unlockSound,
    toggleTimer,
    endSession,
    startFocus,
    startBreak,
    completion,
    closeCompletion,
    study,
    setStudy,
  }

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="sd-toast-region" aria-live="polite">
        {toastState && (
          <p key={toastState.id} className="sd-toast">
            {toastState.message}
          </p>
        )}
      </div>
    </Ctx.Provider>
  )
}
