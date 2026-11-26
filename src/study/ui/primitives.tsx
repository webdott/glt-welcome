import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

export function Dialog({
  open,
  onClose,
  eyebrow,
  title,
  children,
  actions,
  wide,
}: {
  open: boolean
  onClose: () => void
  eyebrow?: string
  title: string
  children?: ReactNode
  actions?: ReactNode
  wide?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      className={`sd-dialog ${wide ? 'is-wide' : ''}`}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="sd-dialog-body">
        <button type="button" className="sd-dialog-close" aria-label="Close" onClick={onClose}>
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
            <path d="M2 2l10 10M12 2 2 12" stroke="currentColor" strokeWidth="1.4" />
          </svg>
        </button>
        {eyebrow && <p className="mono sd-muted">{eyebrow}</p>}
        <h2 id={titleId} className="sd-dialog-title">
          {title}
        </h2>
        {children}
        {actions && <div className="sd-dialog-actions">{actions}</div>}
      </div>
    </dialog>
  )
}

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="sd-field">
      <label className="mono sd-label" htmlFor={htmlFor}>
        {label}
        {hint && <span className="sd-label-hint"> · {hint}</span>}
      </label>
      {children}
    </div>
  )
}

export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string
  options: { value: T; label: string }[]
  value: T | T[]
  onChange: (value: T) => void
  disabled?: boolean
}) {
  const multi = Array.isArray(value)
  const selected = (v: T) => (multi ? (value as T[]).includes(v) : value === v)
  const ref = useRef<HTMLDivElement>(null)
  const [clip, setClip] = useState<string | null>(null)
  const optionsKey = options.map((o) => String(o.value)).join('|')

  // Single choice: an ink copy of the options is clipped down to the chosen one, so the
  // background and text colour move together as one piece.
  useLayoutEffect(() => {
    const el = ref.current
    if (multi || !el) return
    const measure = () => {
      const index = options.findIndex((o) => o.value === value)
      const btn = el.querySelectorAll<HTMLButtonElement>(':scope > button')[index]
      if (!btn) return setClip(null)
      const w = el.clientWidth
      setClip(`inset(0 ${w - btn.offsetLeft - btn.offsetWidth}px 0 ${btn.offsetLeft}px)`)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [multi, value, optionsKey])

  return (
    <div ref={ref} className={`sd-segmented ${multi ? '' : 'is-single'}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" aria-pressed={selected(o.value)} disabled={disabled} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
      {!multi && clip && (
        <div className="sd-segmented-active" aria-hidden style={{ clipPath: clip }}>
          {options.map((o) => (
            <span key={String(o.value)}>{o.label}</span>
          ))}
        </div>
      )}
    </div>
  )
}

export function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="sd-meter" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.min(value, max)}>
      <span style={{ transform: `scaleX(${pct / 100})` }} />
    </div>
  )
}

export function Feedback({ message, error }: { message: string; error?: boolean }) {
  if (!message) return null
  return (
    <p className={`sd-feedback ${error ? 'is-error' : ''}`} role={error ? 'alert' : 'status'}>
      {message}
    </p>
  )
}

/** A line-drawn flower that grows with `progress` (0–1). Only transforms and opacity animate. */
export function Plant({ progress, size = 160, bloom }: { progress: number; size?: number; bloom?: boolean }) {
  const p = bloom ? 1 : Math.max(0, Math.min(1, progress))
  const leaf = (at: number) => Math.max(0, Math.min(1, (p - at) / 0.2))
  const open = Math.max(0, Math.min(1, (p - 0.62) / 0.38))
  return (
    <svg className="sd-plant" width={size} height={size} viewBox="0 0 120 120" aria-hidden>
      <line x1="20" y1="112" x2="100" y2="112" className="sd-plant-ground" />
      <g style={{ transform: `scaleY(${0.12 + p * 0.88})`, transformOrigin: '60px 112px' }} className="sd-plant-grow">
        <path d="M60 112 C 60 92, 58 74, 60 46" className="sd-plant-stem" />
      </g>
      <path
        d="M60 88 C 48 86, 40 78, 38 68 C 50 70, 57 78, 60 88 Z"
        className="sd-plant-leaf"
        style={{ opacity: leaf(0.22), transform: `scale(${0.4 + leaf(0.22) * 0.6})`, transformOrigin: '60px 88px' }}
      />
      <path
        d="M60 76 C 72 74, 80 66, 82 56 C 70 58, 63 66, 60 76 Z"
        className="sd-plant-leaf"
        style={{ opacity: leaf(0.4), transform: `scale(${0.4 + leaf(0.4) * 0.6})`, transformOrigin: '60px 76px' }}
      />
      <g style={{ opacity: Math.max(0.15, open), transform: `translateY(${(1 - p) * 40}px) scale(${0.3 + open * 0.7})`, transformOrigin: '60px 40px' }}>
        {Array.from({ length: 8 }, (_, i) => (
          <ellipse key={i} cx="60" cy="27" rx="5" ry="11" className="sd-plant-petal" transform={`rotate(${i * 45} 60 40)`} />
        ))}
        <circle cx="60" cy="40" r="6" className="sd-plant-heart" />
      </g>
    </svg>
  )
}
