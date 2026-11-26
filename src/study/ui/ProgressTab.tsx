import { useMemo, useState } from 'react'
import { CalendarCheckIcon, FireIcon, FlowerIcon, HourglassIcon, PlantIcon, TreeIcon } from '@phosphor-icons/react/ssr'
import type { Icon } from '@phosphor-icons/react'
import { STREAK_GOALS, STREAK_STORAGE_KEY, activityMonth, streakSnapshot } from '../streak'
import { localDayKey } from '../timer'
import { useStudy } from './context'
import { Dialog, Meter, Plant, Segmented } from './primitives'
import { formatMinutes, plural, useStored } from './stored'
import { TabHero } from './TabHero'
import { Arrow } from '../../components/icons'

const BADGE_ICONS: Record<string, Icon> = {
  'first-bloom': FlowerIcon,
  'triple-spark': FireIcon,
  'study-century': HourglassIcon,
  'week-warrior': CalendarCheckIcon,
  'bloom-crew': PlantIcon,
  'deep-roots': TreeIcon,
}

const normalizeGoal = (raw: any) => ({ goal: (STREAK_GOALS as readonly number[]).includes(raw?.goal) ? raw.goal : 7 })
const longDate = (t: number) => new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }).format(t)

export function ProgressTab() {
  const { timer, now, startFocus, go, toast } = useStudy()
  const [{ goal }, setGoal] = useStored(STREAK_STORAGE_KEY, normalizeGoal, () => ({ goal: 7 }))
  const snap = useMemo(() => streakSnapshot(timer.sessions, now), [timer.sessions, now])
  const [offset, setOffset] = useState(0)
  const [selectedDay, setSelectedDay] = useState(() => localDayKey(Date.now()))
  const [badgeId, setBadgeId] = useState<string | null>(null)
  const busy = Boolean(timer.activeSession)

  const month = activityMonth(snap, Math.max(activityMonth(snap, offset, now).minOffset, offset), now)
  const day = snap.days.get(selectedDay)
  const badge = snap.badges.find((b) => b.id === badgeId)
  const start = (minutes: number, task: string) => (busy ? go('focus') : startFocus({ minutes, task }))

  const mood = snap.today.sessions
    ? 'Today is counted. Keep going at your own pace.'
    : snap.currentStreak
      ? `One finished session today keeps your ${snap.currentStreak}-day streak going.`
      : 'Finish one focus session to start a streak.'

  return (
    <>
      <TabHero
        index="05"
        label="Progress"
        title={['Small wins,', 'every day.']}
        intro={mood}
        actions={
          <button type="button" className="btn btn-primary" onClick={() => start(25, 'Keeping my streak')}>
            {busy ? 'Back to your session' : 'Start 25 minutes'}
          </button>
        }
      />

      <div className="wrap sd-grid">
        <section className="sd-panel sd-span-5 sd-streak" aria-label="Streak">
          <p className="mono sd-muted">Current streak</p>
          <p className="sd-streak-number">
            <span className="display">{snap.currentStreak}</span>
            <span>{snap.currentStreak === 1 ? 'day' : 'days'}</span>
          </p>
          <p className="sd-muted">Best: {plural(snap.bestStreak, 'day')}</p>
          <div className="sd-rule" />
          <div className="sd-row-between">
            <strong>Streak goal</strong>
            <span className="mono sd-muted">{snap.currentStreak >= goal ? `${goal}-day goal reached` : `${snap.currentStreak} / ${goal} days`}</span>
          </div>
          <Meter value={snap.currentStreak} max={goal} label="Streak goal" />
          <Segmented
            label="Streak goal"
            options={STREAK_GOALS.map((g) => ({ value: g as number, label: `${g} days` }))}
            value={goal}
            onChange={(g) => {
              setGoal({ goal: g })
              toast(`${g}-day goal set.`)
            }}
          />
        </section>

        <section className="sd-panel sd-span-7" aria-label="Level">
          <div className="sd-row-between">
            <p className="mono sd-muted">Level {snap.level.number}</p>
            <p className="mono sd-muted">{snap.xp.toLocaleString()} XP</p>
          </div>
          <h2 className="sd-panel-title">{snap.level.name}</h2>
          <Meter value={snap.level.earned} max={snap.level.span} label="Progress to next level" />
          <p className="sd-muted sd-small">{snap.level.remaining.toLocaleString()} XP to level {snap.level.number + 1}. 5 XP for every focused minute.</p>
          <div className="sd-rule" />
          <div className="sd-row-between">
            <strong>Today’s quests</strong>
            <span className="mono sd-muted">{snap.completedQuests} / 3 done</span>
          </div>
          <ul className="sd-quests">
            {snap.quests.map((q) => {
              const remaining = q.metric === 'sessions' ? 25 : Math.min(60, Math.max(1, q.target - q.progress))
              return (
                <li key={q.id} className={q.complete ? 'is-done' : ''}>
                  <div className="sd-row-between">
                    <strong>{q.title}</strong>
                    <span className="mono sd-muted">+{q.bonus} XP</span>
                  </div>
                  <p className="sd-muted sd-small">{q.description}</p>
                  <Meter value={q.progress} max={q.target} label={q.title} />
                  <div className="sd-row-between">
                    <span className="mono sd-muted">
                      {q.progress} / {q.target} {q.metric === 'minutes' ? 'min' : 'session'}
                    </span>
                    {q.complete ? (
                      <span className="mono">Done</span>
                    ) : (
                      <button type="button" className="btn-text" onClick={() => start(remaining, q.title)}>
                        {busy ? 'Back to focus' : `Focus ${remaining} min`}
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>

        <section className="sd-panel sd-span-7" aria-label="Activity">
          <div className="sd-row-between">
            <h2 className="sd-panel-title">{new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(month.first)}</h2>
            <div className="sd-inline">
              <button type="button" className="sd-icon-btn" aria-label="Previous month" disabled={offset <= month.minOffset} onClick={() => setOffset((o) => o - 1)}>
                <Arrow dir="left" />
              </button>
              <button
                type="button"
                className="btn-text"
                onClick={() => {
                  setOffset(0)
                  setSelectedDay(snap.todayKey)
                }}
              >
                Today
              </button>
              <button type="button" className="sd-icon-btn" aria-label="Next month" disabled={offset >= 0} onClick={() => setOffset((o) => Math.min(0, o + 1))}>
                <Arrow />
              </button>
            </div>
          </div>
          <div className="sd-cal-head mono sd-muted" aria-hidden>
            {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="sd-cal">
            {Array.from({ length: month.padding }, (_, i) => (
              <span key={`pad-${i}`} />
            ))}
            {month.days.map((d) => (
              <button
                key={d.key}
                type="button"
                disabled={d.future}
                aria-pressed={d.key === selectedDay}
                data-level={d.minutes >= 60 ? 3 : d.minutes >= 30 ? 2 : d.minutes ? 1 : 0}
                data-today={d.isToday || undefined}
                aria-label={`${longDate(d.date)}, ${plural(d.minutes, 'focused minute')}`}
                onClick={() => setSelectedDay(d.key)}
              >
                {d.number}
              </button>
            ))}
          </div>
          <div className="sd-day-detail">
            <div className="sd-row-between">
              <strong>{longDate(new Date(`${selectedDay}T12:00:00`).getTime())}</strong>
              <span className="mono sd-muted">{day ? `${formatMinutes(day.minutes)} · ${plural(day.sessions, 'session')}` : 'No sessions'}</span>
            </div>
            {day && (
              <ul className="sd-list">
                {[...day.entries].reverse().map((s) => (
                  <li key={s.id}>
                    <span>{s.task}</span>
                    <span className="mono sd-muted">{s.minutes} min</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="sd-panel sd-span-5" aria-label="Badges">
          <div className="sd-row-between">
            <h2 className="sd-panel-title">Badges</h2>
            <span className="mono sd-muted">
              {snap.badges.filter((b) => b.unlocked).length} / {snap.badges.length}
            </span>
          </div>
          <div className="sd-badges">
            {snap.badges.map((b) => {
              const BadgeIcon = BADGE_ICONS[b.id]
              return (
                <button key={b.id} type="button" className={`sd-badge-card ${b.unlocked ? 'is-unlocked' : ''}`} onClick={() => setBadgeId(b.id)}>
                  <BadgeIcon size={26} weight={b.unlocked ? 'fill' : 'light'} aria-hidden />
                  <strong>{b.title}</strong>
                  <span className="mono sd-muted">{b.unlocked ? 'Unlocked' : `${b.progress} / ${b.target}`}</span>
                </button>
              )
            })}
          </div>
        </section>

        <section className="sd-panel sd-span-12" aria-label="Your garden">
          <div className="sd-row-between">
            <h2 className="sd-panel-title">Your garden</h2>
            <span className="mono sd-muted">
              {plural(snap.sessionCount, 'plant')} · {formatMinutes(snap.totalMinutes)} · {plural(snap.activeDays, 'active day')}
            </span>
          </div>
          {snap.sessions.length ? (
            <ul className="sd-garden">
              {[...snap.sessions]
                .reverse()
                .slice(0, 48)
                .map((s) => (
                  <li key={s.id}>
                    <Plant progress={1} bloom size={64} />
                    <strong>{s.task}</strong>
                    <span className="mono sd-muted">
                      {s.minutes} min · {new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(s.completedAt)}
                    </span>
                  </li>
                ))}
            </ul>
          ) : (
            <div className="sd-empty">
              <Plant progress={0} size={96} />
              <p>Every garden starts somewhere. Finish your first focus session and your first plant appears here.</p>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => go('focus')}>
                Go to focus
              </button>
            </div>
          )}
        </section>
      </div>

      <Dialog
        open={Boolean(badge)}
        onClose={() => setBadgeId(null)}
        eyebrow={badge?.unlocked ? 'Unlocked' : 'Next challenge'}
        title={badge?.title ?? ''}
        actions={
          badge && !badge.unlocked ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setBadgeId(null)
                start(25, 'Working towards a badge')
              }}
            >
              {busy ? 'Back to focus' : 'Make some progress'}
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={() => setBadgeId(null)}>
              Close
            </button>
          )
        }
      >
        {badge && (
          <>
            <p>{badge.description}</p>
            <p className="mono sd-muted">
              {badge.unlocked && badge.unlockedAt
                ? `Unlocked ${new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(badge.unlockedAt)}`
                : `${badge.progress} / ${badge.target} ${badge.unit}`}
            </p>
          </>
        )}
      </Dialog>
    </>
  )
}

