import cors from 'cors'
import express, { type Express } from 'express'
import { irrigationRouter } from './routes/irrigation.js'
import { planningRouter } from './routes/planning.js'
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
  app.use(cors())
  app.use(express.json())

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'aquaflow-server', timestamp: new Date().toISOString() })
  })

  app.use('/api/water', waterRouter)
  app.use('/api/sources', sourcesRouter)
  app.use('/api/zones', zonesRouter)
  app.use('/api/system', systemRouter)
  app.use('/api/irrigation', irrigationRouter)
  app.use('/api/planning', planningRouter)

  return app
}
