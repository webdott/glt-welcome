import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

// A full page load (first visit, reload, Safari reopening a tab) starts at the top.
// Only in-app Back/Forward restores the previous position.
let firstRender = true
const restoreAfterFirstRender = () => {
  const restore = !firstRender
  firstRender = false
  return restore
}

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: restoreAfterFirstRender,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
