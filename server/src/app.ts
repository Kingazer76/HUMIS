import cors from 'cors'
import express, { type Express } from 'express'
import { authRouter, requireAuth } from './auth/index.js'
import { assistantRouter, transcribeSpeech } from './routes/assistant.js'
import { historyRouter } from './routes/history.js'
import { irrigationRouter } from './routes/irrigation.js'
import { planningRouter } from './routes/planning.js'
import { settingsRouter } from './routes/settings.js'
import { sourcesRouter } from './routes/sources.js'
import { systemRouter } from './routes/system.js'
import { waterRouter } from './routes/water.js'
import { zonesRouter } from './routes/zones.js'

/**
 * The Express app, exported separately from `index.ts`'s `listen()` call
 * so tests (and any future embedding) can exercise routes without binding
 * a real port or starting the simulation tick loop.
 */
export function createApp(): Express {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', 1)
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
    next()
  })
  app.use(
    cors({
      origin: true,
      credentials: true,
    }),
  )
  app.post(
    '/api/assistant/speech',
    requireAuth,
    express.raw({ type: () => true, limit: '4mb' }),
    transcribeSpeech,
  )
  app.use(express.json({ limit: '256kb' }))

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'aquaflow-server', timestamp: new Date().toISOString() })
  })

  app.use('/api/auth', authRouter)
  app.use('/api/water', requireAuth, waterRouter)
  app.use('/api/sources', requireAuth, sourcesRouter)
  app.use('/api/zones', requireAuth, zonesRouter)
  app.use('/api/system', requireAuth, systemRouter)
  app.use('/api/irrigation', requireAuth, irrigationRouter)
  app.use('/api/planning', requireAuth, planningRouter)
  app.use('/api/history', requireAuth, historyRouter)
  app.use('/api/settings', requireAuth, settingsRouter)
  app.use('/api/assistant', requireAuth, assistantRouter)

  return app
}
