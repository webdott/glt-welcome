export { BusIcon, ClockIcon, MusicNotesIcon } from '@phosphor-icons/react/ssr'

export function Arrow({ dir = 'right' }: { dir?: 'right' | 'up' | 'down' | 'up-right' }) {
  const rotate = { right: 0, up: -90, down: 90, 'up-right': -45 }[dir]
  return (
    <svg className="arrow" width="14" height="14" viewBox="0 0 14 14" aria-hidden style={{ rotate: `${rotate}deg` }}>
      <path d="M1 7h11M7.5 2.5 12 7l-4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

export function Plus() {
  return (
    <svg className="plus" width="12" height="12" viewBox="0 0 12 12" aria-hidden>
      <path d="M6 1v10M1 6h10" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}
