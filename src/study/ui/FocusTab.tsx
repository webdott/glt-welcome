import { useState } from 'react'
import { localDayKey, minutesOn, remainingMs, streakDays } from '../timer'
import { useStudy } from './context'
import { Feedback, Meter, Plant, Segmented } from './primitives'
import { TabHero } from './TabHero'

const PRESETS = [25, 45, 60] as const
const RING = 2 * Math.PI * 46

export function FocusTab() {
  const { timer, now, toggleTimer, endSession } = useStudy()
  const active = timer.activeSession
  const [choice, setChoice] = useState<number | 'custom'>(25)
  const [custom, setCustom] = useState('15')
  const [task, setTask] = useState('')
  const [confirmEnd, setConfirmEnd] = useState(false)

  const isBreak = active?.mode === 'break'
  const running = active?.status === 'running'
  const minutes = choice === 'custom' ? Number(custom) : choice
  const ms = active ? remainingMs(active, now) : (Number.isFinite(minutes) ? minutes : 0) * 60000
  const seconds = Math.ceil(ms / 1000)
  const progress = active ? Math.min(1, Math.max(0, 1 - ms / active.durationMs)) : 0
  const clock = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`

  const today = minutesOn(timer.sessions, localDayKey(now))
  const goal = timer.settings.dailyGoal
  const streak = streakDays(timer.sessions, now)

  const status = active ? (running ? (isBreak ? 'On a break' : 'Focusing') : 'Paused') : 'Next session'
  const stage = !active
    ? 'Ready to grow'
    : isBreak
      ? 'Resting'
      : progress < 0.3
        ? 'Putting down roots'
        : progress < 0.72
          ? 'Finding its rhythm'
          : 'Almost in bloom'

  return (
    <>
      <TabHero
        index="03"
        label="Focus"
        title={['One thing,', 'fully.']}
        intro="Name what you’re working on, pick a length and start. The timer keeps going if you refresh or switch tabs."
      />
      <div className="wrap sd-grid">
        <section className="sd-panel sd-span-7 sd-timer" aria-labelledby="sd-timer-heading">
          <p className="mono sd-muted" id="sd-timer-heading">
            {status}
          </p>
          <div className="sd-ring">
            <svg viewBox="0 0 100 100" aria-hidden>
              <circle cx="50" cy="50" r="46" className="sd-ring-track" />
              <circle
                cx="50"
                cy="50"
                r="46"
                className={`sd-ring-fill ${isBreak ? 'is-break' : ''}`}
                strokeDasharray={RING}
                strokeDashoffset={RING * (1 - progress)}
              />
            </svg>
            <div className="sd-ring-center">
              <span className="display sd-clock" role="timer" aria-label={`${Math.floor(seconds / 60)} minutes ${seconds % 60} seconds`}>
                {clock}
              </span>
              <span className="sd-muted">{active ? active.task : 'room for one good thing'}</span>
            </div>
          </div>

          {!active && (
            <div className="sd-timer-setup">
              <Segmented
                label="Session length"
                options={[...PRESETS.map((m) => ({ value: m as number | 'custom', label: `${m} min` })), { value: 'custom', label: 'Custom' }]}
                value={choice}
                onChange={setChoice}
              />
              {choice === 'custom' && (
                <label className="sd-inline">
                  <input
                    className="sd-input sd-input-short"
                    type="number"
                    min={1}
                    max={180}
                    inputMode="numeric"
                    value={custom}
                    onChange={(e) => setCustom(e.target.value)}
                    aria-label="Custom minutes"
                  />
                  <span className="sd-muted">minutes, 1 to 180</span>
                </label>
              )}
              <input
                className="sd-input"
                placeholder="What are you focusing on?"
                maxLength={80}
                value={task}
                onChange={(e) => setTask(e.target.value)}
                aria-label="What are you focusing on?"
              />
            </div>
          )}

          <div className="sd-timer-actions">
            <button type="button" className="btn btn-primary" onClick={() => toggleTimer({ minutes, task: task.trim() })}>
              {active ? (running ? 'Pause' : 'Resume') : 'Start focusing'}
            </button>
            {active && (
              <button type="button" className="btn btn-outline" onClick={() => (isBreak ? endSession() : setConfirmEnd(true))}>
                {isBreak ? 'Finish break' : 'End session'}
              </button>
            )}
          </div>
          {confirmEnd && active && !isBreak && (
            <div className="sd-confirm" role="alertdialog" aria-label="End this session early?">
              <p>Ending early clears this session. Only finished sessions grow a plant.</p>
              <div className="sd-inline">
                <button type="button" className="btn-text" onClick={() => setConfirmEnd(false)}>
                  Keep going
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    setConfirmEnd(false)
                    endSession()
                  }}
                >
                  End session
                </button>
              </div>
            </div>
          )}
          <Feedback message={active && running && !isBreak ? 'Your timer keeps running when you change tabs.' : ''} />
        </section>

        <aside className="sd-panel sd-span-5 sd-growth">
          <div className="sd-growth-art">
            <Plant progress={isBreak ? 1 : progress} size={200} />
          </div>
          <div className="sd-row-between">
            <strong>{stage}</strong>
            <span className="mono sd-muted">{isBreak ? 'Resting' : `${Math.floor(progress * 100)}% grown`}</span>
          </div>
          <Meter value={isBreak ? 1 : progress} max={1} label="Plant growth" />

          <div className="sd-rule" />
          <div className="sd-row-between">
            <strong>{today >= goal ? 'Daily goal reached' : 'Today’s goal'}</strong>
            <span className="mono sd-muted">
              {today} / {goal} min
            </span>
          </div>
          <Meter value={today} max={goal} label="Daily goal" />

          <dl className="sd-stats">
            <Stat label="Today" value={today} unit="min" />
            <Stat label="Garden" value={timer.sessions.length} unit={timer.sessions.length === 1 ? 'plant' : 'plants'} />
            <Stat label="Streak" value={streak} unit={streak === 1 ? 'day' : 'days'} />
          </dl>
        </aside>
      </div>
    </>
  )
}

export function Stat({ label, value, unit }: { label: string; value: number | string; unit?: string }) {
  return (
    <div className="sd-stat">
      <dt className="mono sd-muted">{label}</dt>
      <dd>
        <span className="display">{value}</span>
        {unit && <span className="sd-muted"> {unit}</span>}
      </dd>
    </div>
  )
}
