import { useEffect } from 'react'
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'

import appCss from '../styles.css?url'
import { SITE_NAME } from '../site'

// Site-wide tags. Each page adds its own title, description and share image.
export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
      { name: 'theme-color', content: '#0e150c' },
      { name: 'application-name', content: SITE_NAME },
      { name: 'apple-mobile-web-app-title', content: SITE_NAME },
      { property: 'og:site_name', content: SITE_NAME },
      { property: 'og:type', content: 'website' },
      { property: 'og:locale', content: 'en_NG' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/favicon.ico', sizes: '48x48' },
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      { rel: 'manifest', href: '/site.webmanifest' },
      { rel: 'preconnect', href: 'https://images.unsplash.com' },
    ],
    // Runs before the browser's own restore on reload, which would otherwise drop you mid-page.
    scripts: [{ children: "if ('scrollRestoration' in history) history.scrollRestoration = 'manual'" }],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NG">
      <head>
        <HeadContent />
      </head>
      <body>
        <StartAtTop />
        {children}
        <Scripts />
      </body>
    </html>
  )
}

/**
 * Full page loads open at the top. The router flips the browser back to automatic scroll
 * restoration as the page unloads, which makes Safari reopen mid-page, so undo that last.
 */
function StartAtTop() {
  useEffect(() => {
    const keepManual = () => {
      history.scrollRestoration = 'manual'
    }
    window.addEventListener('pagehide', keepManual)
    if (!location.hash) window.scrollTo(0, 0)
    return () => window.removeEventListener('pagehide', keepManual)
  }, [])
  return null
}
