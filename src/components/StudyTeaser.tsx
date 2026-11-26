import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { STORAGE_KEY, localDayKey, minutesOn, normalizeState, streakDays } from '#/study/timer'
import type { Tab } from '#/study/ui/context'
import { Lines, Reveal } from './motion'
import { SectionLabel } from './Sections'
import { Arrow } from './icons'

const TOOLS: { tab: Tab; name: string; body: string }[] = [
  { tab: 'timetable', name: 'Study timetable', body: 'Your courses and free hours become a month of study blocks, with reminders.' },
  { tab: 'cgpa', name: 'CGPA calculator', body: 'Units and grades on OAU’s 5-point scale, semester by semester.' },
  { tab: 'focus', name: 'Focus timer', body: 'One thing at a time. Each finished session grows a plant.' },
  { tab: 'buddy', name: 'Study Buddy', body: 'Turn your PDFs, photos and notes into revision notes and practice questions.' },
  { tab: 'progress', name: 'Progress', body: 'Streaks, daily quests and a garden of everything you’ve finished.' },
]

/** Shows a returning student their own numbers; renders nothing until it has read this device's data. */
function useTodayStats() {
  const [stats, setStats] = useState<{ minutes: number; streak: number } | null>(null)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const { sessions } = normalizeState(JSON.parse(raw))
      if (sessions.length) setStats({ minutes: minutesOn(sessions, localDayKey(Date.now())), streak: streakDays(sessions) })
    } catch {
      /* storage unavailable */
    }
  }, [])
  return stats
}

export function StudyTeaser() {
  const stats = useTodayStats()
  return (
    <section id="study" className="section wrap">
      <SectionLabel index="06" title="Study space" aside="Free for students" />
      <div className="grid study-teaser">
        <div className="study-teaser-intro">
          <Lines className="display section-title" lines={['Church on Sunday.', 'Study all week.']} />
          <Reveal>
            <p className="study-teaser-lede">
              A free study space for OAU students, built into this site. Plan your semester, check your CGPA and revise from your own notes. Nothing to sign up for;
              everything stays on your phone.
            </p>
          </Reveal>
          <Reveal className="study-teaser-actions" delay={0.08}>
            <Link to="/study" search={{ tab: 'timetable' }} className="btn btn-primary">
              Open the study space <Arrow />
            </Link>
            {stats && (
              <span className="mono study-teaser-stats">
                Today: {stats.minutes} min · Streak: {stats.streak} {stats.streak === 1 ? 'day' : 'days'}
              </span>
            )}
          </Reveal>
        </div>
        <ul className="study-tools">
          {TOOLS.map((t, i) => (
            <Reveal as="li" key={t.tab} delay={i * 0.05}>
              <Link to="/study" search={{ tab: t.tab }} className="study-tool">
                <span className="mono study-tool-index">{String(i + 1).padStart(2, '0')}</span>
                <span className="study-tool-text">
                  <span className="study-tool-name">{t.name}</span>
                  <span className="study-tool-body">{t.body}</span>
                </span>
                <Arrow dir="up-right" />
              </Link>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  )
}
