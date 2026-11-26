import { useEffect, useRef, useState } from 'react'
import { MotionConfig, motion } from 'motion/react'
import { Link } from '@tanstack/react-router'
import { BellIcon, GearSixIcon, QuestionIcon } from '@phosphor-icons/react/ssr'
import { DAILY_GOALS } from '../timer'
import { StudyProvider, TABS, useStudy } from './context'
import type { Tab } from './context'
import { Dialog, Field, Plant } from './primitives'
import { plural } from './stored'
import { TimetableTab } from './TimetableTab'
import { CgpaTab } from './CgpaTab'
import { FocusTab } from './FocusTab'
import { BuddyTab } from './BuddyTab'
import { ProgressTab } from './ProgressTab'

const TAB_LABELS: Record<Tab, string> = {
  timetable: 'Timetable',
  cgpa: 'CGPA',
  focus: 'Focus',
  buddy: 'Study Buddy',
  progress: 'Progress',
}

export function StudyApp({ tab }: { tab: Tab }) {
  return (
    <MotionConfig reducedMotion="user">
      <StudyProvider tab={tab}>
        <Shell />
      </StudyProvider>
    </MotionConfig>
  )
}

function Shell() {
  const { tab } = useStudy()
  const [dialog, setDialog] = useState<'reminders' | 'settings' | 'help' | null>(null)
  const close = () => setDialog(null)
  const navRef = useRef<HTMLElement>(null)

  // On phones the tab row scrolls; keep the active tab in view.
  useEffect(() => {
    navRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [tab])

  return (
    <div className="sd">
      <header className="sd-header">
        <div className="sd-header-row">
          <Link to="/" className="wordmark" aria-label="GLT Ile-Ife home">
            <span className="wordmark-glt">GLT</span>
            <span className="wordmark-branch">Study space</span>
          </Link>
          <nav ref={navRef} className="sd-tabs" aria-label="Study tools">
            {TABS.map((t) => (
              <Link key={t} to="/study" search={{ tab: t }} className="sd-tab" aria-current={t === tab ? 'page' : undefined}>
                {TAB_LABELS[t]}
                {t === tab && <motion.span layoutId="sd-tab-line" className="sd-tab-line" transition={{ duration: 0.25, ease: [0.77, 0, 0.175, 1] }} />}
              </Link>
            ))}
          </nav>
          <div className="sd-header-actions">
            <RemindersButton onOpen={() => setDialog('reminders')} />
            <button type="button" className="sd-icon-btn" aria-label="Settings" onClick={() => setDialog('settings')}>
              <GearSixIcon size={18} aria-hidden />
            </button>
            <button type="button" className="sd-icon-btn" aria-label="How it works" onClick={() => setDialog('help')}>
              <QuestionIcon size={18} aria-hidden />
            </button>
          </div>
        </div>
      </header>

      <ReminderBanner />

      <main className="sd-main" id="main">
        <div key={tab} className="sd-view">
          {tab === 'timetable' && <TimetableTab />}
          {tab === 'cgpa' && <CgpaTab />}
          {tab === 'focus' && <FocusTab />}
          {tab === 'buddy' && <BuddyTab />}
          {tab === 'progress' && <ProgressTab />}
        </div>
      </main>

      <footer className="sd-footer wrap mono">
        <span>Everything here is saved on this device only.</span>
        <Link to="/" className="link">
          Back to GLT Ile-Ife
        </Link>
      </footer>

      <RemindersDialog open={dialog === 'reminders'} onClose={close} />
      <SettingsDialog open={dialog === 'settings'} onClose={close} />
      <HelpDialog open={dialog === 'help'} onClose={close} />
      <CompletionDialog />
    </div>
  )
}

function RemindersButton({ onOpen }: { onOpen: () => void }) {
  const { study } = useStudy()
  const unread = study.notifications.filter((n) => !n.read).length
  return (
    <button type="button" className="sd-icon-btn" aria-label={unread ? `Study reminders, ${unread} unread` : 'Study reminders'} onClick={onOpen}>
      <BellIcon size={18} aria-hidden />
      {unread > 0 && <span className="sd-badge mono">{unread > 9 ? '9+' : unread}</span>}
    </button>
  )
}

const sessionTime = (t: number, timeZone: string) => new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZone }).format(t)
const sessionDate = (t: number, timeZone: string) => new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone }).format(t)

function useStartPlanned() {
  const { study, setStudy, startFocus } = useStudy()
  return (sessionId: string) => {
    const s = study.plan?.sessions.find((x) => x.id === sessionId)
    if (!s) return
    if (startFocus({ minutes: s.minutes, task: `${s.code} · ${s.title}` })) {
      setStudy((prev) => ({ ...prev, notifications: prev.notifications.map((n) => (n.sessionId === sessionId ? { ...n, read: true } : n)) }))
    }
  }
}

function ReminderBanner() {
  const { study, setStudy, now } = useStudy()
  const start = useStartPlanned()
  if (!study.remindersEnabled || !study.plan) return null
  const live = [...study.notifications]
    .reverse()
    .find((n) => !n.read && (study.plan!.sessions.find((s) => s.id === n.sessionId)?.endAt ?? 0) > now)
  const session = live && study.plan.sessions.find((s) => s.id === live.sessionId)
  if (!live || !session) return null
  return (
    <aside className="sd-banner" aria-live="polite">
      <div className="wrap sd-banner-row">
        <p>
          <strong>
            {live.type === 'upcoming' ? 'Coming up' : 'Time to study'} · {session.code}
          </strong>
          <span>
            {session.title} · {sessionTime(session.startAt, study.plan.timeZone)} · {session.minutes} min
          </span>
        </p>
        <div className="sd-banner-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => start(session.id)}>
            Start now
          </button>
          <button
            type="button"
            className="btn-text"
            onClick={() =>
              setStudy((prev) => ({ ...prev, notifications: prev.notifications.map((n) => (n.sessionId === session.id ? { ...n, read: true } : n)) }))
            }
          >
            Dismiss
          </button>
        </div>
      </div>
    </aside>
  )
}

function RemindersDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { study, setStudy, go } = useStudy()
  const start = useStartPlanned()
  const unread = study.notifications.filter((n) => !n.read).length
  const tz = study.plan?.timeZone ?? 'UTC'
  return (
    <Dialog
      open={open}
      onClose={onClose}
      eyebrow={`${unread} unread`}
      title="Study reminders"
      actions={
        <>
          {unread > 0 && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setStudy((prev) => ({ ...prev, notifications: prev.notifications.map((n) => ({ ...n, read: true })) }))}
            >
              Mark all read
            </button>
          )}
          <button
            type="button"
            className="btn-text"
            onClick={() => {
              onClose()
              go('timetable')
            }}
          >
            View timetable
          </button>
        </>
      }
    >
      <label className="sd-check">
        <input type="checkbox" checked={study.remindersEnabled} onChange={(e) => setStudy((prev) => ({ ...prev, remindersEnabled: e.target.checked }))} />
        <span>Remind me while this page is open</span>
      </label>
      <div className="sd-reminder-list">
        {study.notifications.length ? (
          [...study.notifications].reverse().map((n) => {
            const s = study.plan?.sessions.find((x) => x.id === n.sessionId)
            if (!s) return null
            return (
              <article key={n.id} className={`sd-reminder ${n.read ? 'is-read' : ''}`}>
                <div>
                  <strong>
                    {n.type === 'upcoming' ? 'Coming up' : 'Time to study'} · {s.code}
                  </strong>
                  <p>{s.title}</p>
                  <span className="mono sd-muted">
                    {sessionDate(s.startAt, tz)} · {sessionTime(s.startAt, tz)}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn-text"
                  onClick={() => {
                    onClose()
                    start(s.id)
                  }}
                >
                  Study now
                </button>
              </article>
            )
          })
        ) : (
          <p className="sd-muted">Reminders appear here as your scheduled study blocks come up.</p>
        )}
      </div>
    </Dialog>
  )
}

function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { timer, setTimer, sound, toast } = useStudy()
  const [goal, setGoal] = useState(timer.settings.dailyGoal)
  const [soundOn, setSoundOn] = useState(timer.settings.soundEnabled)
  const [testing, setTesting] = useState('')
  const [wasOpen, setWasOpen] = useState(false)
  if (open && !wasOpen) {
    setWasOpen(true)
    setGoal(timer.settings.dailyGoal)
    setSoundOn(timer.settings.soundEnabled)
    setTesting('')
  }
  if (!open && wasOpen) setWasOpen(false)

  const test = async () => {
    if (sound.playing) {
      sound.stop()
      setTesting('')
      return
    }
    await sound.unlock()
    const result = sound.play({ onEnded: () => setTesting('') })
    setTesting(
      result.sound
        ? result.vibration
          ? 'Playing a 5-second chime with vibration.'
          : 'Playing a 5-second chime.'
        : result.vibration
          ? 'Vibration only: sound is unavailable in this browser.'
          : 'Sound couldn’t play. Check this site’s sound permission.',
    )
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        sound.stop()
        onClose()
      }}
      eyebrow="Settings"
      title="Your rhythm"
      actions={
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setTimer((t) => ({ ...t, settings: { dailyGoal: goal, soundEnabled: soundOn } }))
            sound.stop()
            onClose()
            toast('Settings saved.')
          }}
        >
          Save
        </button>
      }
    >
      <Field label="Daily focus goal" htmlFor="sd-goal">
        <select id="sd-goal" className="sd-input" value={goal} onChange={(e) => setGoal(Number(e.target.value))}>
          {DAILY_GOALS.map((g) => (
            <option key={g} value={g}>
              {g < 60 ? `${g} minutes` : `${g / 60} ${g === 60 ? 'hour' : 'hours'}`}
            </option>
          ))}
        </select>
      </Field>
      <label className="sd-check">
        <input type="checkbox" checked={soundOn} onChange={(e) => setSoundOn(e.target.checked)} />
        <span>Chime when a session ends</span>
      </label>
      <div className="sd-inline">
        <button type="button" className="btn btn-outline btn-sm" disabled={!soundOn} onClick={test}>
          {testing ? 'Stop' : 'Test sound'}
        </button>
        {testing && <span className="sd-muted">{testing}</span>}
      </div>
    </Dialog>
  )
}

function HelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const steps = [
    ['Plan your month', 'Add your courses and the hours you can study. You get a month of study blocks, shared evenly across your courses.'],
    ['Focus on one thing', 'Start a timer for a study block or anything else. It keeps going if you refresh or switch tabs.'],
    ['Watch it grow', 'Each finished session adds a plant to your garden, counts towards your daily goal and keeps your streak alive.'],
    ['Revise from your own notes', 'Study Buddy turns your PDFs, Word files, photos or typed notes into revision notes and practice questions, on your device.'],
  ]
  return (
    <Dialog open={open} onClose={onClose} eyebrow="How it works" title="A study space for your semester" actions={<button type="button" className="btn btn-primary" onClick={onClose}>Got it</button>}>
      <ol className="sd-steps">
        {steps.map(([title, body], i) => (
          <li key={title}>
            <span className="mono sd-muted">{String(i + 1).padStart(2, '0')}</span>
            <div>
              <strong>{title}</strong>
              <p>{body}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="sd-muted sd-small">Nothing is uploaded. Your timetable, results, notes and progress stay in this browser on this device.</p>
    </Dialog>
  )
}

function CompletionDialog() {
  const { completion, closeCompletion, startBreak, go } = useStudy()
  const session = completion?.session
  const isBreak = session?.mode === 'break'
  const rewards = completion?.rewards
  const minutes = session ? Math.round(session.durationMs / 60000) : 0
  // Start the plant closed and let it bloom once the dialog is up.
  const [bloom, setBloom] = useState(0)
  useEffect(() => {
    if (!completion) return setBloom(0)
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setBloom(1)))
    return () => cancelAnimationFrame(id)
  }, [completion])
  return (
    <Dialog
      open={Boolean(completion)}
      onClose={closeCompletion}
      eyebrow={isBreak ? 'Break over' : 'Session complete'}
      title={isBreak ? 'Ready for the next one?' : 'A new bloom.'}
      actions={
        isBreak ? (
          <button type="button" className="btn btn-primary" onClick={closeCompletion}>
            Start a new session
          </button>
        ) : (
          <>
            <button type="button" className="btn btn-primary" onClick={startBreak}>
              Take a 5-minute break
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                closeCompletion()
                go('progress')
              }}
            >
              See progress
            </button>
          </>
        )
      }
    >
      {!isBreak && session && (
        <div className="sd-completion">
          <Plant progress={bloom} size={120} />
          <div>
            <p>
              {plural(minutes, 'focused minute')} on <strong>{session.task}</strong>. It’s in your garden now.
            </p>
            {rewards && (
              <p className="sd-completion-xp">
                <span className="display">+{rewards.xp}</span> <span className="mono">XP</span>
              </p>
            )}
            {rewards?.levelUp && <p className="mono">Level {rewards.level.number} · {rewards.level.name}</p>}
            {rewards && (rewards.badges.length > 0 || rewards.quests.length > 0) && (
              <p className="sd-muted">
                {[...rewards.badges.map((b) => `${b.title} badge unlocked`), ...rewards.quests.map((q) => `${q.title} complete`)].join(' · ')}
              </p>
            )}
          </div>
        </div>
      )}
      {isBreak && <p>Pick one small thing to give your attention to next.</p>}
    </Dialog>
  )
}
