import { defineConfig } from 'vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'

// SITE_URL wins (set it for a custom domain); on Vercel the production domain is used automatically.
const siteUrl = (
  process.env.SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`) ||
  'http://localhost:3000'
).replace(/\/$/, '')

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  define: { __SITE_URL__: JSON.stringify(siteUrl) },
  plugins: [nitro(), tanstackStart(), viteReact()],
})

export default config
