import type { ReactNode } from 'react'

export function TabHero({ index, label, title, intro, actions }: { index: string; label: string; title: string[]; intro: string; actions?: ReactNode }) {
  return (
    <div className="wrap sd-hero">
      <p className="section-label mono">
        <span>
          {index} <span className="slash">/</span> {label}
        </span>
        <span>Study space</span>
      </p>
      <div className="sd-hero-row">
        <h1 className="display sd-hero-title">
          {title.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </h1>
        <div className="sd-hero-side">
          <p>{intro}</p>
          {actions && <div className="sd-hero-actions">{actions}</div>}
        </div>
      </div>
    </div>
  )
}
