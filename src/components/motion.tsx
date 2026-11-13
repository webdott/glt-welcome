import { useEffect, useRef, useState } from 'react'
import type { ElementType, ReactNode } from 'react'
import {
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'motion/react'
import type { MotionValue } from 'motion/react'

export const EASE_OUT = [0.23, 1, 0.32, 1] as const
export const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const

const VIEWPORT = { once: true, margin: '0px 0px -6% 0px' } as const

export function Reveal({
  children,
  delay = 0,
  className,
  as = 'div',
}: {
  children: ReactNode
  delay?: number
  className?: string
  as?: 'div' | 'li' | 'p' | 'section'
}) {
  const Tag = motion[as]
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={VIEWPORT}
      transition={{ duration: 0.8, ease: EASE_OUT, delay }}
    >
      {children}
    </Tag>
  )
}

/** Each line rises out of its own mask. */
export function Lines({
  lines,
  as: Tag = 'h2',
  className,
  delay = 0,
  onLoad = false,
}: {
  lines: string[]
  as?: ElementType
  className?: string
  delay?: number
  onLoad?: boolean
}) {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, VIEWPORT)
  const show = onLoad || inView
  return (
    <Tag ref={ref} className={className} aria-label={lines.join(' ')}>
      {lines.map((line, i) => (
        <span key={i} className="mask" aria-hidden>
          <motion.span
            className="mask-inner"
            initial={{ y: '108%' }}
            animate={show ? { y: '0%' } : undefined}
            transition={{ duration: 1.1, ease: EASE_OUT, delay: delay + i * 0.09 }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </Tag>
  )
}

/** Wipes up from the bottom while the photo settles from a slight zoom. */
export function ImageReveal({
  src,
  alt,
  className,
  sizes = '100vw',
  parallax = 0,
}: {
  src: string
  alt: string
  className?: string
  sizes?: string
  parallax?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, VIEWPORT)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], [`${-parallax}%`, `${parallax}%`])

  // The observer sits on an unclipped wrapper: Chrome never reports a target
  // hidden by its own clip-path as intersecting.
  return (
    <div ref={ref} className={`media ${className ?? ''}`}>
      <motion.div
        className="media-clip"
        initial={{ clipPath: 'inset(100% 0% 0% 0%)' }}
        animate={inView ? { clipPath: 'inset(0% 0% 0% 0%)' } : undefined}
        transition={{ duration: 1.2, ease: EASE_IN_OUT }}
      >
      <motion.img
        src={`${src}?auto=format&fit=crop&w=1600&q=75`}
        srcSet={[800, 1200, 1600, 2400]
          .map((w) => `${src}?auto=format&fit=crop&w=${w}&q=75 ${w}w`)
          .join(', ')}
        sizes={sizes}
        alt={alt}
        loading="lazy"
        decoding="async"
        style={parallax ? { y, height: `${100 + parallax * 2}%`, top: `${-parallax}%` } : undefined}
        initial={{ scale: 1.18 }}
        animate={inView ? { scale: 1 } : undefined}
        transition={{ duration: 1.8, ease: EASE_OUT }}
      />
      </motion.div>
    </div>
  )
}

/** Words brighten as the paragraph scrolls through the reading line. */
export function ScrollWords({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.85', 'end 0.5'] })
  const words = text.split(' ')
  return (
    <p ref={ref} className={className}>
      {words.map((word, i) =>
        reduce ? (
          <span key={i}>{word} </span>
        ) : (
          <Word key={i} progress={scrollYProgress} range={[i / words.length, (i + 1) / words.length]}>
            {word}
          </Word>
        ),
      )}
    </p>
  )
}

function Word({ children, progress, range }: { children: string; progress: MotionValue<number>; range: [number, number] }) {
  const opacity = useTransform(progress, range, [0.16, 1])
  return (
    <>
      <motion.span style={{ opacity }}>{children}</motion.span>{' '}
    </>
  )
}

/** Client-only clock so server and first client render agree. */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
