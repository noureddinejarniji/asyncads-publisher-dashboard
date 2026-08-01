/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Dev-only proxy for Google Play lookups (no public CORS API exists).
 * Mirrors the production serverless function at /api/play.js so the frontend
 * can call `/api/play?q=<name>` the same way in dev and prod.
 */
function playProxy(): Plugin {
  return {
    name: 'play-proxy',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/play', async (req, res) => {
        res.setHeader('Content-Type', 'application/json')
        try {
          const q = new URL(req.url ?? '', 'http://localhost').searchParams.get('q')
          if (!q) {
            res.statusCode = 400
            res.end(JSON.stringify({ error: 'missing q' }))
            return
          }
          type PlayApp = { appId: string; title: string; icon: string; developer: string; url: string }
          type GPlay = { search: (opts: { term: string; num: number }) => Promise<PlayApp[]> }
          // google-play-scraper ships no types; shape just what we use.
          const mod = (await import('google-play-scraper')) as unknown as GPlay & { default?: GPlay }
          const gplay = mod.default ?? mod
          const found = await gplay.search({ term: q, num: 6 })
          res.end(
            JSON.stringify({
              results: found.map((a) => ({
                appId: a.appId,
                title: a.title,
                icon: a.icon,
                developer: a.developer,
                url: a.url,
              })),
            }),
          )
        } catch (e) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: e instanceof Error ? e.message : 'failed' }))
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), playProxy()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
