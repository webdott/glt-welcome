import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  motion,
  useAnimationFrame,
  useInView,
  useMotionValue,
  useScroll,
  useVelocity,
} from 'motion/react'
import type { MotionValue } from 'motion/react'
import gallery from '#/gallery.json'
import { Lines, Reveal } from './motion'
import { Arrow, PauseIcon, PlayIcon } from './icons'

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
  const reduce = useMedia('(prefers-reduced-motion: reduce)')
  const count = gallery.rows.flat().length

  const hint = reduce
    ? mouse
      ? 'Scroll sideways or use the arrows'
      : 'Swipe to look around'
    : wide
      ? 'Drag to explore · Hover to pause'
      : `${mouse ? 'Click' : 'Tap'} to move · Hold to pause`

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
            <p className="mono gallery-hint">{hint}</p>
          </Reveal>
        </div>
      </div>
      {reduce ? <Swipe showButtons={mouse} /> : wide ? <Marquee /> : <Stories />}
    </section>
  )
}

/* Two rows drifting in opposite directions; each can be dragged or flung */

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
      onPointerEnter={(e) => e.pointerType === 'mouse' && (hovered.current = true)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && (hovered.current = false)}
    >
      {gallery.rows.map((row, i) => (
        <MarqueeRow
          key={i}
          photos={row}
          direction={i % 2 ? 1 : -1}
          drift={DRIFT}
          speed={speed}
          running={inView}
        />
      ))}
    </div>
  )
}

const MAX_FLING = 4000 // px per second

function MarqueeRow({
  photos,
  direction,
  drift,
  speed,
  running,
}: {
  photos: Photo[]
  direction: 1 | -1
  drift: number
  speed: MotionValue<number>
  running: boolean
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const setRef = useRef<HTMLDivElement>(null)
  const width = useRef(0)
  const x = useMotionValue(0)
  const drag = useRef({ active: false, id: -1, lastX: 0, lastT: 0, velocity: 0 })
  const fling = useRef(0)

  const wrap = (n: number) => {
    const w = width.current
    return w ? ((n % w) - w) % w : n
  }

  useEffect(() => {
    const el = setRef.current
    if (!el) return
    const ro = new ResizeObserver(() => (width.current = el.offsetWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Two-finger trackpad swipes move the row; vertical scrolling passes through to the page.
  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return
      e.preventDefault()
      fling.current = 0
      x.set(wrap(x.get() - e.deltaX))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  useAnimationFrame((_, delta) => {
    if (!running || !width.current || drag.current.active) return
    // The fling decays like a thrown object, while the drift carries on underneath it.
    fling.current *= Math.exp(-delta / 325)
    if (Math.abs(fling.current) < 4) fling.current = 0
    const v = direction * drift * speed.get() + fling.current
    x.set(wrap(x.get() + v * (delta / 1000)))
  })

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    drag.current = { active: true, id: e.pointerId, lastX: e.clientX, lastT: e.timeStamp, velocity: 0 }
    fling.current = 0
    e.currentTarget.setPointerCapture(e.pointerId)
    e.currentTarget.dataset.dragging = 'true'
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d.active || e.pointerId !== d.id) return
    const dx = e.clientX - d.lastX
    const dt = Math.max(e.timeStamp - d.lastT, 1)
    x.set(wrap(x.get() + dx))
    d.velocity = d.velocity * 0.6 + (dx / dt) * 0.4
    d.lastX = e.clientX
    d.lastT = e.timeStamp
  }

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d.active || e.pointerId !== d.id) return
    d.active = false
    // A finger that stopped before lifting shouldn't throw the row.
    const v = e.timeStamp - d.lastT > 80 ? 0 : d.velocity * 1000
    fling.current = Math.max(-MAX_FLING, Math.min(MAX_FLING, v))
    delete e.currentTarget.dataset.dragging
  }

  const sizes = (p: Photo) =>
    `(min-width: 1750px) ${Math.round(p.ratio * 420)}px, (min-width: 900px) ${(p.ratio * 24).toFixed(1)}vw, ${(p.ratio * 56).toFixed(1)}vw`

  return (
    <motion.div
      ref={trackRef}
      className="marquee-track"
      style={{ x }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
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

/* Phones: one photo at a time, like stories */

const STORY_MS = 4500
const HOLD_MS = 220

function leadFirst(photos: Photo[]) {
  const lead = photos.filter((p) => p.id === gallery.mobileFirst)
  return [...lead, ...photos.filter((p) => p.id !== gallery.mobileFirst)]
}

function Stories() {
  const photos = useMemo(() => leadFirst(gallery.rows.flat()), [])
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { amount: 0.5 })
  const [index, setIndex] = useState(0)
  const [loaded, setLoaded] = useState<Record<string, boolean>>({})
  const [holding, setHolding] = useState(false)
  const [stopped, setStopped] = useState(false)
  const press = useRef({ t: 0, x: 0, handled: false })

  const count = photos.length
  const go = (step: 1 | -1) => setIndex((i) => (i + step + count) % count)
  const current = photos[index]
  const paused = holding || stopped || !inView || !loaded[current.id]

  const onPointerDown = (e: React.PointerEvent) => {
    press.current = { t: e.timeStamp, x: e.clientX, handled: false }
    setHolding(true)
  }
  const onPointerUp = (e: React.PointerEvent) => {
    setHolding(false)
    const p = press.current
    const dx = e.clientX - p.x
    // A sideways flick moves between photos; a long press was only a pause.
    if (Math.abs(dx) > 40) {
      p.handled = true
      go(dx < 0 ? 1 : -1)
    } else if (e.timeStamp - p.t > HOLD_MS) {
      p.handled = true
    }
  }
  const onZoneClick = (step: 1 | -1) => {
    if (press.current.handled) {
      press.current.handled = false
      return
    }
    go(step)
  }

  // Keep the previous, current and next photo mounted so the next one is decoded before it shows.
  const mounted = [-1, 0, 1].map((o) => photos[(index + o + count) % count])
  return (
    <div className="stories-wrap">
      <div
        ref={ref}
        className="stories"
        data-paused={paused}
        role="region"
        aria-roledescription="carousel"
        aria-label="Photos from GLT Ile-Ife"
        style={{ '--story-ms': `${STORY_MS}ms` } as React.CSSProperties}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setHolding(false)}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="stories-backdrop" style={{ backgroundImage: `url(${current.lqip})` }} />
        {mounted.map((p) => (
          <figure
            key={p.id}
            className="story"
            data-state={p.id === current.id ? 'current' : 'idle'}
            data-fit={p.ratio > 1 ? 'contain' : 'cover'}
            data-loaded={!!loaded[p.id]}
            aria-hidden={p.id !== current.id || undefined}
          >
            <img
              src={`/gallery/${p.id}-960.webp`}
              srcSet={srcSet(p)}
              sizes="100vw"
              alt=""
              decoding="async"
              draggable={false}
              ref={(img) => {
                if (img?.complete && img.naturalWidth && !loaded[p.id]) setLoaded((l) => ({ ...l, [p.id]: true }))
              }}
              onLoad={() => setLoaded((l) => ({ ...l, [p.id]: true }))}
            />
          </figure>
        ))}

        <div className="stories-bars" aria-hidden>
          {photos.map((p, i) => (
            <span key={p.id} className="stories-bar" data-done={i < index || undefined}>
              {i === index && <span key={index} className="stories-fill" onAnimationEnd={() => go(1)} />}
            </span>
          ))}
        </div>

        <button type="button" className="stories-zone is-prev" aria-label="Previous photo" onClick={() => onZoneClick(-1)} />
        <button type="button" className="stories-zone is-next" aria-label="Next photo" onClick={() => onZoneClick(1)} />

        <div className="stories-foot">
          <span className="mono" aria-live="polite">
            {String(index + 1).padStart(2, '0')} / {count}
          </span>
          <button
            type="button"
            className="stories-toggle"
            aria-label={stopped ? 'Play photos' : 'Pause photos'}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={() => setStopped((v) => !v)}
          >
            {stopped ? <PlayIcon weight="fill" className="ico" aria-hidden /> : <PauseIcon weight="fill" className="ico" aria-hidden />}
          </button>
        </div>
      </div>
    </div>
  )
}

/* Reduced motion: a native swipe row, no per-frame JavaScript */

function Swipe({ showButtons }: { showButtons: boolean }) {
  const scroller = useRef<HTMLDivElement>(null)
  const bar = useRef<HTMLSpanElement>(null)
  const photos = leadFirst(gallery.rows.flat())

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
