import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'motion/react'
import { images } from '#/content'
import { formatCountdown, formatDay, formatTime, nextGathering } from '#/lib/schedule'
import { EASE_OUT, Lines, useNow } from './motion'
import { Arrow } from './icons'

const rise = (delay: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.9, ease: EASE_OUT, delay },
})

export function Hero() {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const imgY = useTransform(scrollYProgress, [0, 1], ['0%', '18%'])
  const contentY = useTransform(scrollYProgress, [0, 1], ['0%', '-10%'])

  return (
    <section ref={ref} id="top" className="hero">
      <div className="hero-frame">
        <motion.img
          className="hero-img"
          src={`${images.hero.src}?auto=format&fit=crop&w=2400&q=75`}
          srcSet={[900, 1400, 2000, 2800]
            .map((w) => `${images.hero.src}?auto=format&fit=crop&w=${w}&q=75 ${w}w`)
            .join(', ')}
          sizes="100vw"
          alt={images.hero.alt}
          fetchPriority="high"
          style={{ y: imgY }}
          initial={{ scale: 1.14, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 2, ease: EASE_OUT }}
        />
        <div className="hero-scrim" />
      </div>

      <motion.div className="hero-content wrap" style={{ y: contentY }}>
        <motion.ul className="hero-meta mono" {...rise(0.9)}>
          <li>God’s Love Tabernacle</li>
          <li>Ibadan Road, Ile-Ife</li>
          <li className="hide-sm">7.48° N · 4.56° E</li>
        </motion.ul>

        <div>
          <Lines as="h1" className="display hero-title" lines={['Welcome home,', 'fresher.']} onLoad delay={0.25} />
          <div className="hero-rail grid">
            <motion.p className="hero-lede" {...rise(0.85)}>
              A church family of OAU students and staff. Sundays at 8 and 10, Bible Study every Wednesday evening.
            </motion.p>
            <motion.div className="hero-next" {...rise(0.95)}>
              <NextUp />
            </motion.div>
            <motion.div className="hero-actions" {...rise(1.05)}>
              <a href="#first-sunday" className="btn btn-primary">
                Plan your first Sunday <Arrow />
              </a>
              <a href="#week" className="btn btn-ghost-light">
                Service times
              </a>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </section>
  )
}

function NextUp() {
  const now = useNow()
  if (now === null) {
    return (
      <>
        <p className="mono label-light">Next gathering</p>
        <p className="next-title">Sunday · 8:00am & 10:00am</p>
      </>
    )
  }
  const next = nextGathering(now)
  return (
    <>
      <p className="mono label-light">
        <span className="live-dot" aria-hidden /> {next.live ? 'Happening now' : 'Next gathering'}
      </p>
      <p className="next-title">
        {next.gathering.name} · {formatDay(next.at)}, {formatTime(next.at)}
      </p>
      {!next.live && <p className="mono next-count">{formatCountdown(next.at - now)}</p>}
    </>
  )
}
