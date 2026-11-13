import { useState } from 'react'
import { motion, useMotionValueEvent, useScroll } from 'motion/react'
import { EASE_OUT } from './motion'

const links = [
  { href: '#week', label: 'Service times' },
  { href: '#programmes', label: 'Programmes' },
  { href: '#first-sunday', label: 'First visit' },
  { href: '#visit', label: 'Find us' },
]

export function Header() {
  const { scrollY } = useScroll()
  const [solid, setSolid] = useState(false)
  const [hidden, setHidden] = useState(false)

  useMotionValueEvent(scrollY, 'change', (y) => {
    const prev = scrollY.getPrevious() ?? 0
    const hero = document.getElementById('top')
    setSolid(y > (hero?.offsetHeight ?? window.innerHeight) - 64)
    if (y > 80 && y > prev + 2) setHidden(true)
    else if (y < prev - 2 || y <= 80) setHidden(false)
  })

  return (
    <motion.header
      className="header"
      data-solid={solid}
      data-hidden={hidden}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8, ease: EASE_OUT, delay: 0.6 }}
    >
      <a href="#top" className="wordmark" aria-label="GLT Ile-Ife, back to top">
        <span className="wordmark-glt">GLT</span>
        <span className="wordmark-branch">Ile-Ife</span>
      </a>
      <nav aria-label="Sections" className="nav">
        {links.map((l) => (
          <a key={l.href} href={l.href} className="nav-link">
            {l.label}
          </a>
        ))}
      </nav>
      <a href="#visit" className="btn btn-primary btn-sm">
        Plan a visit
      </a>
    </motion.header>
  )
}
