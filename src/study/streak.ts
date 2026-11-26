// Streak, XP, daily quests and badges, all derived from finished focus sessions.
// Ported from Focus Garden's streak-core.
import { localDayKey, streakDays } from './timer'
import type { Session } from './timer'

export const STREAK_STORAGE_KEY = 'focus-garden-streak-v1'
export const XP_PER_MINUTE = 5
export const STREAK_GOALS = [3, 7, 14, 30] as const

type Metric = 'sessions' | 'minutes'
export const QUESTS = [
  { id: 'show-up', title: 'Show up', description: 'Finish one focus session today.', target: 1, metric: 'sessions' as Metric, bonus: 20 },
  { id: 'half-hour', title: 'Half an hour', description: 'Collect 30 focused minutes today.', target: 30, metric: 'minutes' as Metric, bonus: 40 },
  { id: 'power-hour', title: 'The full hour', description: 'Collect 60 focused minutes today.', target: 60, metric: 'minutes' as Metric, bonus: 60 },
]

type BadgeMetric = 'sessionCount' | 'bestStreak' | 'totalMinutes'
export const BADGES = [
  { id: 'first-bloom', title: 'First bloom', description: 'Complete your first focus session.', metric: 'sessionCount' as BadgeMetric, target: 1, unit: 'session' },
  { id: 'triple-spark', title: 'Three in a row', description: 'Build a streak of 3 days.', metric: 'bestStreak' as BadgeMetric, target: 3, unit: 'days in a row' },
  { id: 'study-century', title: 'Study century', description: 'Reach 100 completed focus minutes.', metric: 'totalMinutes' as BadgeMetric, target: 100, unit: 'minutes' },
  { id: 'week-warrior', title: 'A full week', description: 'Build a streak of 7 days.', metric: 'bestStreak' as BadgeMetric, target: 7, unit: 'days in a row' },
  { id: 'bloom-crew', title: 'Ten blooms', description: 'Complete 10 focus sessions.', metric: 'sessionCount' as BadgeMetric, target: 10, unit: 'sessions' },
  { id: 'deep-roots', title: 'Deep roots', description: 'Build a streak of 30 days.', metric: 'bestStreak' as BadgeMetric, target: 30, unit: 'days in a row' },
]

const LEVEL_NAMES = ['Seed starter', 'Budding scholar', 'Focus explorer', 'Rhythm keeper', 'Deep thinker', 'Garden guardian', 'Focus legend', 'Evergreen']

export function levelForXP(xp: number) {
  const safe = Math.max(0, Math.floor(xp))
  const level = Math.floor(Math.sqrt(safe / 100)) + 1
  const floor = (level - 1) ** 2 * 100
  const next = level ** 2 * 100
  return {
    number: level,
    name: LEVEL_NAMES[Math.min(LEVEL_NAMES.length - 1, level - 1)],
    floor,
    next,
    earned: safe - floor,
    span: next - floor,
    remaining: next - safe,
    percent: Math.min(100, ((safe - floor) / (next - floor)) * 100),
  }
}

type Day = { key: string; minutes: number; sessions: number; entries: Session[] }

const dailyBonus = (day?: Day) => (day ? QUESTS.reduce((sum, q) => sum + (day[q.metric] >= q.target ? q.bonus : 0), 0) : 0)

export function streakSnapshot(input: Session[], now = Date.now()) {
  const seen = new Set<string>()
  const sessions = (Array.isArray(input) ? input : [])
    .filter((s) => {
      const valid =
        s &&
        typeof s.id === 'string' &&
        !seen.has(s.id) &&
        Number.isFinite(s.completedAt) &&
        s.completedAt >= 0 &&
        s.completedAt <= now &&
        Number.isInteger(s.minutes) &&
        s.minutes > 0 &&
        s.minutes <= 180
      if (valid) seen.add(s.id)
      return valid
    })
    .sort((a, b) => a.completedAt - b.completedAt)

  const days = new Map<string, Day>()
  const unlockedAt = new Map<string, number>()
  let totalMinutes = 0
  let running = 0
  let bestStreak = 0
  let previousDay: string | null = null
  for (const [index, s] of sessions.entries()) {
    const key = localDayKey(s.completedAt)
    const day = days.get(key) || { key, minutes: 0, sessions: 0, entries: [] }
    day.minutes += s.minutes
    day.sessions += 1
    day.entries.push(s)
    days.set(key, day)
    totalMinutes += s.minutes
    if (key !== previousDay) {
      const prior = new Date(`${key}T12:00:00`)
      prior.setDate(prior.getDate() - 1)
      running = localDayKey(prior.getTime()) === previousDay ? running + 1 : 1
      previousDay = key
      bestStreak = Math.max(bestStreak, running)
    }
    for (const b of BADGES) {
      const count = b.metric === 'totalMinutes' ? totalMinutes : b.metric === 'sessionCount' ? index + 1 : bestStreak
      if (!unlockedAt.has(b.id) && count >= b.target) unlockedAt.set(b.id, s.completedAt)
    }
  }
  const todayKey = localDayKey(now)
  const today = days.get(todayKey) || { key: todayKey, minutes: 0, sessions: 0, entries: [] }
  const bonusXP = [...days.values()].reduce((sum, d) => sum + dailyBonus(d), 0)
  const xp = totalMinutes * XP_PER_MINUTE + bonusXP
  const quests = QUESTS.map((q) => ({ ...q, progress: Math.min(q.target, today[q.metric]), complete: today[q.metric] >= q.target }))
  const badges = BADGES.map((b) => {
    const count = b.metric === 'totalMinutes' ? totalMinutes : b.metric === 'sessionCount' ? sessions.length : bestStreak
    return { ...b, progress: Math.min(b.target, count), unlocked: count >= b.target, unlockedAt: unlockedAt.get(b.id) || null }
  })
  return {
    sessions,
    days,
    totalMinutes,
    sessionCount: sessions.length,
    activeDays: days.size,
    currentStreak: streakDays(sessions, now),
    bestStreak,
    today,
    todayKey,
    xp,
    bonusXP,
    level: levelForXP(xp),
    quests,
    badges,
    completedQuests: quests.filter((q) => q.complete).length,
  }
}

export type Snapshot = ReturnType<typeof streakSnapshot>

/** What a just-finished session earned: XP, a level-up, and any badges or quests it unlocked. */
export function completionRewards(input: Session[], id: string, now = Date.now()) {
  const after = streakSnapshot(input, now)
  if (!after.sessions.some((s) => s.id === id)) return null
  const before = streakSnapshot(
    after.sessions.filter((s) => s.id !== id),
    now,
  )
  return {
    xp: after.xp - before.xp,
    levelUp: after.level.number > before.level.number,
    level: after.level,
    badges: after.badges.filter((b) => b.unlocked && !before.badges.find((x) => x.id === b.id)?.unlocked),
    quests: after.quests.filter((q) => q.complete && !before.quests.find((x) => x.id === q.id)?.complete),
    currentStreak: after.currentStreak,
  }
}

export function activityMonth(snapshot: Snapshot, offset = 0, now = Date.now()) {
  const today = new Date(now)
  today.setHours(12, 0, 0, 0)
  const first = new Date(today.getFullYear(), today.getMonth() + offset, 1, 12)
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0, 12)
  const padding = (first.getDay() + 6) % 7
  const days = []
  for (let n = 1; n <= last.getDate(); n += 1) {
    const date = new Date(first.getFullYear(), first.getMonth(), n, 12)
    const key = localDayKey(date.getTime())
    const entry = snapshot.days.get(key)
    days.push({
      number: n,
      key,
      date: date.getTime(),
      minutes: entry?.minutes || 0,
      sessions: entry?.sessions || 0,
      future: date > today,
      isToday: key === snapshot.todayKey,
    })
  }
  const oldest = snapshot.sessions.length ? new Date(snapshot.sessions[0].completedAt) : today
  const oldestOffset = (oldest.getFullYear() - today.getFullYear()) * 12 + oldest.getMonth() - today.getMonth()
  return { first: first.getTime(), padding, days, minOffset: Math.min(-11, oldestOffset) }
}
