import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import express, { type Express } from 'express'

/**
 * Serves the Vite production build (`client/dist`) from this Express
 * process so one always-on Node service can host both the UI and `/api`.
 * Tab paths such as `/overview` have no matching file, so unmatched GET
 * requests fall back to `index.html` for React Router. `/api` is never
 * rewritten. No-op when the client has not been built (local API-only).
 */
export function clientDistPath(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '../../client/dist')
}

export function attachFrontend(app: Express, distDir = clientDistPath()): boolean {
  const indexHtml = join(distDir, 'index.html')
  if (!existsSync(indexHtml)) {
    // eslint-disable-next-line no-console
    console.warn(`AquaFlow frontend build not found at ${distDir}. Serving API only.`)
    return false
  }

  app.use(express.static(distDir))
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      next()
      return
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next()
      return
    }
    res.sendFile(indexHtml)
  })
  return true
}
