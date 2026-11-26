import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { motion, useMotionValueEvent, useScroll } from 'motion/react'
import { EASE_OUT } from './motion'
import { Logo } from './Logo'

const links = [
  { href: '#week', label: 'Service times' },
  { href: '#programmes', label: 'Programmes' },
  { href: '#first-sunday', label: 'First visit' },
  { href: '#visit', label: 'Find us' },
]

export function Header() {
  const { scrollY } = useScroll()
  const [state, setState] = useState<'top' | 'float' | 'solid'>('top')
  const [hidden, setHidden] = useState(false)

  useMotionValueEvent(scrollY, 'change', (y) => {
    const prev = scrollY.getPrevious() ?? 0
    const hero = document.getElementById('top')
    setState(y > (hero?.offsetHeight ?? window.innerHeight) - 64 ? 'solid' : y > 4 ? 'float' : 'top')
    if (y > 48 && y > prev + 2) setHidden(true)
    else if (y < prev - 2 || y <= 48) setHidden(false)
  })

  return (
    <motion.header
      className="header"
      data-state={state}
      data-hidden={hidden}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8, ease: EASE_OUT, delay: 0.6 }}
    >
      <a href="#top" className="wordmark" aria-label="God’s Love Tabernacle International Church, Ile-Ife Extension. Back to top">
        <Logo />
      </a>
      <nav aria-label="Sections" className="nav">
        {links.map((l) => (
          <a key={l.href} href={l.href} className="nav-link">
            {l.label}
          </a>
        ))}
        <Link to="/study" className="nav-link">
          Study space
        </Link>
      </nav>
      <a href="#visit" className="btn btn-primary btn-sm">
        Plan a visit
      </a>
    </motion.header>
  )
}
