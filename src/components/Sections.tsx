import { motion, useInView } from 'motion/react'
import { useRef } from 'react'
import { church, finestWorship, firstSunday, gatherings, images } from '#/content'
import type { Gathering, Programme } from '#/content'
import {
  downloadGathering,
  downloadProgramme,
  formatCountdown,
  formatDay,
  formatLongDay,
  formatTime,
  isEvening,
  nextFor,
  nextGathering,
  programmeStatus,
} from '#/lib/schedule'
import type { ProgrammeStatus } from '#/lib/schedule'
import { EASE_OUT, ImageReveal, Lines, Reveal, ScrollWords, useNow } from './motion'
import { Arrow, BusIcon, ClockIcon, MusicNotesIcon, Plus } from './icons'

function SectionLabel({ index, title, aside, dark }: { index: string; title: string; aside?: string; dark?: boolean }) {
  return (
    <Reveal className={`section-label mono ${dark ? 'is-dark' : ''}`}>
      <span>
        {index} <span className="slash">/</span> {title}
      </span>
      {aside && <span>{aside}</span>}
    </Reveal>
  )
}

export function Intro() {
  return (
    <section id="about" className="section wrap">
      <SectionLabel index="01" title="Who we are" aside="GLT Ile-Ife" />
      <div className="grid intro-statement">
        <ScrollWords
          className="statement"
          text="We are the Ife home of God’s Love Tabernacle. Most of us study at OAU, so we remember what a first semester feels like: new hall, new timetable, new city. Whatever else is new, you don’t have to find a church family on your own."
        />
      </div>
      <div className="grid intro-body">
        <ImageReveal
          className="intro-media"
          src={images.students.src}
          alt={images.students.alt}
          sizes="(min-width: 900px) 55vw, 100vw"
          parallax={6}
        />
        <dl className="facts">
          {[
            ['What we teach', 'The New Creation realities in Christ Jesus, taught with simplicity and clarity.'],
            ['The wider family', 'One of 23 GLT extensions across Africa, Europe and North America.'],
            ['Set Man Representatives', church.pastors],
          ].map(([k, v], i) => (
            <Reveal key={k} className="fact" delay={i * 0.08}>
              <dt className="mono">{k}</dt>
              <dd>{v}</dd>
            </Reveal>
          ))}
        </dl>
      </div>
    </section>
  )
}

export function Week() {
  const now = useNow()
  const next = now === null ? null : nextGathering(now)
  return (
    <section id="week" className="section wrap">
      <SectionLabel index="02" title="Every week" aside="All times WAT" />
      <Lines className="display section-title" lines={['Your week', 'at GLT Ife']} />
      <ul className="week">
        {gatherings.map((g, i) => (
          <WeekRow key={g.id} g={g} index={i} now={now} isNext={next?.gathering.id === g.id} />
        ))}
      </ul>
    </section>
  )
}

function WeekRow({ g, index, now, isNext }: { g: Gathering; index: number; now: number | null; isNext: boolean }) {
  const [h, m] = g.start.split(':').map(Number)
  const hour12 = ((h + 11) % 12) + 1
  const upcoming = now === null ? null : nextFor(g, now)
  return (
    <Reveal as="li" className="week-row" delay={index * 0.06}>
      <span className="week-day mono">{g.day}</span>
      <span className="week-time display">
        {hour12}:{String(m).padStart(2, '0')}
        <span className="mono week-ampm">{h < 12 ? 'am' : 'pm'}</span>
      </span>
      <div className="week-info">
        <h3 className="week-name">
          {g.name}
          {isNext && upcoming && (
            <span className="tag tag-live mono">
              {upcoming.live ? <MusicNotesIcon className="ico" aria-hidden /> : <ClockIcon className="ico" aria-hidden />}
              {upcoming.live ? 'Now' : `Next · ${formatCountdown(upcoming.at - (now ?? 0))}`}
            </span>
          )}
        </h3>
        <p className="week-note">{g.note}</p>
        {g.recurrence === 'last-sun' && upcoming && (
          <p className="mono week-sub">Next one: {formatLongDay(upcoming.at)}</p>
        )}
      </div>
      <button type="button" className="btn-text week-cal" onClick={() => downloadGathering(g)}>
        <Plus /> Add to calendar
      </button>
    </Reveal>
  )
}

export function Programmes() {
  const now = useNow()
  const fw = finestWorship
  const at = Date.parse(fw.startsAt)
  const sms = now === null ? null : nextFor(gatherings.find((g) => g.recurrence === 'last-sun')!, now)

  return (
    <section id="programmes" className="section section-dark">
      <div className="wrap">
        <SectionLabel index="03" title="Special programmes" aside="Upcoming" dark />
      </div>

      <article className="feature">
        <div className="feature-stage">
          <ImageReveal className="feature-media" src={images.worship.src} alt={images.worship.alt} parallax={8} />
          <div className="feature-overlay wrap">
            <p className="mono label-light">{fw.kicker}</p>
            <Lines as="h2" className="display feature-title" lines={[fw.title]} />
          </div>
        </div>

        <div className="wrap grid feature-info">
          <Reveal className="feature-blurb">
            <p>{fw.blurb}</p>
            {fw.transport && (
              <div className="feature-transport">
                <p className="mono">
                  <BusIcon className="ico ico-lg" aria-hidden /> Transport provided
                </p>
                <p>{fw.transport}</p>
              </div>
            )}
          </Reveal>
          <Reveal className="feature-meta feature-date" delay={0.06}>
            <p className="mono label-light">Date</p>
            <p>
              {formatLongDay(at)}
              {!fw.confirmed && <span className="tag mono">To be confirmed</span>}
            </p>
          </Reveal>
          <Reveal className="feature-meta feature-time" delay={0.12}>
            <p className="mono label-light">Time</p>
            <p>
              {formatTime(at)} – {formatTime(at + fw.durationHours * 3_600_000)}
            </p>
          </Reveal>
          <Reveal className="feature-meta feature-where" delay={0.18}>
            <p className="mono label-light">Where</p>
            <p className="feature-venue">{fw.venue}</p>
            <p className="feature-address">{fw.address}</p>
            <a className="btn-text" href={fw.mapsUrl} target="_blank" rel="noreferrer">
              Directions <Arrow dir="up-right" />
            </a>
          </Reveal>
          <Reveal className="feature-count" delay={0.24}>
            <ProgrammeCountdown programme={fw} now={now} />
          </Reveal>
        </div>
      </article>

      <div className="wrap grid cards">
        <Reveal className="card">
          <p className="mono label-light">Monthly · Last Sunday · 8:00am</p>
          <h3 className="card-title display">Special Miracle Service</h3>
          <p className="card-body">
            One combined service of worship, the Word and the working of miracles.
          </p>
          <p className="mono card-foot">{sms ? `Next: ${formatDay(sms.at)}` : 'Last Sunday of the month'}</p>
        </Reveal>
        <Reveal className="card" delay={0.08}>
          <p className="mono label-light">Across the GLT family</p>
          <h3 className="card-title display">Conferences & outreaches</h3>
          <p className="card-body">
            New flyers land on GLT’s events page first. Check it at the start of each month.
          </p>
          <a className="btn-text card-foot" href={`${church.hq}/events`} target="_blank" rel="noreferrer">
            See all events <Arrow dir="up-right" />
          </a>
        </Reveal>
      </div>
    </section>
  )
}

function countdownText(s: ProgrammeStatus, at: number): [big: string, label: string] {
  switch (s.kind) {
    case 'days':
      return [String(s.days), s.days === 1 ? 'day to go' : 'days to go']
    case 'tomorrow':
      return ['Tomorrow', `From ${formatTime(at)}`]
    case 'today':
      return [isEvening(at) ? 'Tonight' : 'Today', `Starts ${formatCountdown(s.startsIn)}`]
    case 'live':
      return ['Now', 'Happening now']
    case 'past':
      return ['', `Held on ${formatLongDay(at)}. The next date will be announced here.`]
  }
}

function ProgrammeCountdown({ programme: p, now }: { programme: Programme; now: number | null }) {
  const at = Date.parse(p.startsAt)
  const status = now === null ? null : programmeStatus(p.startsAt, p.durationHours, now)
  const [big, label] = status ? countdownText(status, at) : ['—', '']

  return (
    <>
      {big && <span className="display">{big}</span>}
      <span className="mono label-light with-ico">
        {status?.kind === 'live' && <MusicNotesIcon className="ico" aria-hidden />}
        {label}
      </span>
      {status && status.kind !== 'live' && status.kind !== 'past' && (
        <button type="button" className="btn btn-ghost-light" onClick={() => downloadProgramme(p)}>
          <Plus /> Save the date
        </button>
      )}
    </>
  )
}

export function FirstSunday() {
  return (
    <section id="first-sunday" className="section wrap">
      <SectionLabel index="04" title="Your first Sunday" aside="For freshers" />
      <div className="grid first">
        <div className="first-aside">
          <Lines className="display section-title" lines={['New here?', 'Here’s how', 'Sunday goes.']} />
          <ImageReveal
            className="first-media"
            src={images.welcome.src}
            alt={images.welcome.alt}
            sizes="(min-width: 900px) 40vw, 100vw"
          />
        </div>
        <ol className="steps">
          {firstSunday.map((s, i) => (
            <Reveal as="li" key={s.title} className="step" delay={i * 0.05}>
              <span className="mono step-num">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="step-title">{s.title}</h3>
              <p className="step-body">{s.body}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  )
}

export function Visit() {
  return (
    <section id="visit" className="visit">
      <div className="visit-stage">
        <ImageReveal className="visit-media" src={images.visit.src} alt={images.visit.alt} parallax={10} />
        <div className="visit-scrim" />
        <div className="visit-content wrap">
          <SectionLabel index="05" title="Find us" aside="Ile-Ife, Osun State" dark />
          <div className="grid visit-grid">
            <Lines className="display visit-title" lines={['Ibadan Road,', 'Ile-Ife']} />
            <Reveal className="visit-col">
              <p className="mono label-light">Pastors</p>
              <p>{church.pastors}</p>
            </Reveal>
            <Reveal className="visit-col" delay={0.06}>
              <p className="mono label-light">Talk to us</p>
              <p>
                <a className="link" href={`tel:${church.phone.replace(/\s/g, '')}`}>
                  {church.phone}
                </a>
                <br />
                <a className="link" href={`mailto:${church.email}`}>
                  {church.email}
                </a>
              </p>
            </Reveal>
            <Reveal className="visit-actions" delay={0.12}>
              <a className="btn btn-primary" href={church.mapsUrl} target="_blank" rel="noreferrer">
                Get directions <Arrow dir="up-right" />
              </a>
            </Reveal>
          </div>
        </div>
      </div>
      <Reveal className="wrap sister">
        <p className="mono">Closer to the teaching hospital?</p>
        <p>
          GLT also meets at {church.sister.address}, same service times.{' '}
          <a className="link" href={church.sister.mapsUrl} target="_blank" rel="noreferrer">
            Directions to {church.sister.name}
          </a>
        </p>
      </Reveal>
    </section>
  )
}

export function Closing() {
  const ref = useRef<HTMLHeadingElement>(null)
  const inView = useInView(ref, { once: true, margin: '0px 0px -10% 0px' })
  const words = ['See', 'you', 'Sunday.']
  let n = 0
  return (
    <footer className="closing">
      <div className="wrap">
        <h2 ref={ref} className="display closing-title" aria-label="See you Sunday.">
          {words.map((w) => (
            <span key={w} className="closing-word" aria-hidden>
              {[...w].map((ch) => {
                const i = n++
                return (
                  <span key={i} className="mask">
                    <motion.span
                      className="mask-inner"
                      initial={{ y: '108%' }}
                      animate={inView ? { y: '0%' } : undefined}
                      transition={{ duration: 1, ease: EASE_OUT, delay: i * 0.035 }}
                    >
                      {ch}
                    </motion.span>
                  </span>
                )
              })}
            </span>
          ))}
        </h2>

        <div className="grid footer-grid">
          <div className="footer-col">
            <p className="mono label-light">Gatherings</p>
            <p>Sunday 8:00am & 10:00am</p>
            <p>Wednesday 5:30pm, Bible Study</p>
            <p>Last Sunday 8:00am, SMS</p>
          </div>
          <div className="footer-col">
            <p className="mono label-light">Visit</p>
            <p>{church.address}</p>
            <a className="link" href={church.mapsUrl} target="_blank" rel="noreferrer">
              Directions
            </a>
          </div>
          <div className="footer-col">
            <p className="mono label-light">Contact</p>
            <a className="link" href={`tel:${church.phone.replace(/\s/g, '')}`}>
              {church.phone}
            </a>
            <a className="link" href={`mailto:${church.email}`}>
              {church.email}
            </a>
          </div>
          <div className="footer-col">
            <p className="mono label-light">GLT worldwide</p>
            <a className="link" href={church.hq} target="_blank" rel="noreferrer">
              glt.church
            </a>
            <a className="link" href={`${church.hq}/sermons`} target="_blank" rel="noreferrer">
              Sermons
            </a>
            <a className="link" href={`${church.hq}/im-new`} target="_blank" rel="noreferrer">
              I’m new
            </a>
          </div>
        </div>

        <div className="footer-base mono">
          <span>© {new Date().getFullYear()} God’s Love Tabernacle, Ile-Ife</span>
          <a href="#top" className="link">
            Back to top <Arrow dir="up" />
          </a>
        </div>
      </div>
    </footer>
  )
}
