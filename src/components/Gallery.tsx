import { useCallback, useEffect, useRef, useState } from 'react'
import {
  motion,
  useAnimationFrame,
  useInView,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useVelocity,
} from 'motion/react'
import type { MotionValue } from 'motion/react'
import gallery from '#/gallery.json'
import { Lines, Reveal } from './motion'
import { Arrow } from './icons'

type Photo = (typeof gallery.rows)[number][number]

const DRIFT = 34 // px per second at rest

const srcSet = (p: Photo) =>
  gallery.heights.map((h) => `/gallery/${p.id}-${h}.webp ${p.widths[String(h) as keyof Photo['widths']]}w`).join(', ')

function Shot({ photo, sizes, hidden }: { photo: Photo; sizes: string; hidden?: boolean }) {
  const [loaded, setLoaded] = useState(false)
  // Cached images can finish before hydration, so their onLoad never reaches React.
  const ref = useCallback((img: HTMLImageElement | null) => {
    if (img?.complete && img.naturalWidth) setLoaded(true)
  }, [])
  return (
    <figure
      className="shot"
      data-loaded={loaded}
      aria-hidden={hidden || undefined}
      style={{ aspectRatio: photo.ratio, backgroundImage: `url(${photo.lqip})` }}
    >
      <img
        ref={ref}
        src={`/gallery/${photo.id}-640.webp`}
        srcSet={srcSet(photo)}
        sizes={sizes}
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
        onLoad={() => setLoaded(true)}
      />
    </figure>
  )
}

function useMedia(query: string) {
  const [match, setMatch] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const update = () => setMatch(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [query])
  return match
}

export function Gallery() {
  const mouse = useMedia('(hover: hover) and (pointer: fine)')
  const wide = useMedia('(min-width: 900px)')
  const reduce = useReducedMotion()
  const drift = mouse && wide && !reduce
  const count = gallery.rows.flat().length

  return (
    <section id="gallery" className="section gallery">
      <div className="wrap">
        <Reveal className="section-label mono">
          <span>
            02 <span className="slash">/</span> Life at GLT Ife
          </span>
          <span>{count} moments</span>
        </Reveal>
        <div className="grid gallery-head">
          <Lines className="display section-title" lines={['A home,', 'not a crowd.']} />
          <Reveal className="gallery-intro" delay={0.1}>
            <p>Sundays, Wednesdays and the moments in between. These are the people you’ll be worshipping with.</p>
            <p className="mono gallery-hint">{drift ? 'Hover to pause' : mouse ? 'Scroll sideways or use the arrows' : 'Swipe to look around'}</p>
          </Reveal>
        </div>
      </div>
      {drift ? <Marquee /> : <Swipe showButtons={mouse} />}
    </section>
  )
}

/* Desktop: two rows drifting in opposite directions */

function Marquee() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { margin: '200px 0px' })
  const hovered = useRef(false)
  const speed = useMotionValue(1)
  const { scrollY } = useScroll()
  const scrollVelocity = useVelocity(scrollY)

  useAnimationFrame((_, delta) => {
    if (!inView) return
    const boost = Math.min(Math.abs(scrollVelocity.get()) / 1200, 2.5)
    const target = hovered.current ? 0 : 1 + boost
    // Frame-rate independent easing toward the target speed.
    speed.set(speed.get() + (target - speed.get()) * (1 - Math.exp(-delta / 260)))
  })

  return (
    <div
      ref={ref}
      className="marquee"
      onPointerEnter={() => (hovered.current = true)}
      onPointerLeave={() => (hovered.current = false)}
    >
      {gallery.rows.map((row, i) => (
        <MarqueeRow key={i} photos={row} direction={i % 2 ? 1 : -1} speed={speed} running={inView} />
      ))}
    </div>
  )
}

function MarqueeRow({
  photos,
  direction,
  speed,
  running,
}: {
  photos: Photo[]
  direction: 1 | -1
  speed: MotionValue<number>
  running: boolean
}) {
  const setRef = useRef<HTMLDivElement>(null)
  const width = useRef(0)
  const x = useMotionValue(0)

  useEffect(() => {
    const el = setRef.current
    if (!el) return
    const ro = new ResizeObserver(() => (width.current = el.offsetWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useAnimationFrame((_, delta) => {
    const w = width.current
    if (!running || !w) return
    const next = x.get() + direction * DRIFT * speed.get() * (delta / 1000)
    x.set((((next % w) - w) % w))
  })

  const sizes = (p: Photo) => `(min-width: 1750px) ${Math.round(p.ratio * 420)}px, ${(p.ratio * 24).toFixed(1)}vw`

  return (
    <motion.div className="marquee-track" style={{ x }}>
      {[0, 1].map((copy) => (
        <div key={copy} ref={copy === 0 ? setRef : undefined} className="marquee-set" aria-hidden={copy === 1 || undefined}>
          {photos.map((p) => (
            <Shot key={p.id} photo={p} sizes={sizes(p)} hidden={copy === 1} />
          ))}
        </div>
      ))}
    </motion.div>
  )
}

/* Touch and reduced motion: a native swipe row, no per-frame JavaScript */

function Swipe({ showButtons }: { showButtons: boolean }) {
  const scroller = useRef<HTMLDivElement>(null)
  const bar = useRef<HTMLSpanElement>(null)
  const all = gallery.rows.flat()
  const lead = all.filter((p) => p.id === gallery.mobileFirst)
  const photos = [...lead, ...all.filter((p) => p.id !== gallery.mobileFirst)]

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    let frame = 0
    const update = () => {
      frame = 0
      const max = el.scrollWidth - el.clientWidth
      const progress = max > 0 ? el.scrollLeft / max : 0
      if (bar.current) bar.current.style.transform = `scaleX(${0.08 + progress * 0.92})`
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [])

  const page = (dir: 1 | -1) => {
    const el = scroller.current
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' })
  }

  const sizes = (p: Photo) =>
    `(min-width: 500px) ${Math.round(p.ratio * 460)}px, ${Math.min(p.ratio * 92, 100).toFixed(1)}vw`

  return (
    <div className="swipe-wrap">
      <div ref={scroller} className="swipe" role="region" aria-label="Photos from GLT Ile-Ife" tabIndex={0}>
        <div className="swipe-track">
          {photos.map((p) => (
            <Shot key={p.id} photo={p} sizes={sizes(p)} />
          ))}
        </div>
      </div>
      <div className="wrap swipe-foot">
        <span className="swipe-progress" aria-hidden>
          <span ref={bar} />
        </span>
        {showButtons && (
          <div className="swipe-buttons">
            <button type="button" className="swipe-btn" aria-label="Previous photos" onClick={() => page(-1)}>
              <Arrow dir="left" />
            </button>
            <button type="button" className="swipe-btn" aria-label="Next photos" onClick={() => page(1)}>
              <Arrow />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
