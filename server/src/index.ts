import cors from 'cors'
import express from 'express'

const PORT = Number(process.env.PORT ?? 5418)

const app = express()
app.use(cors())
app.use(express.json())

/**
 * Phase 0 only proves the server boots and is reachable through the
 * client's dev proxy. Domain routes (/api/water, /api/zones, ...) are
 * added starting in Phase 1.
 */
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'aquaflow-server', timestamp: new Date().toISOString() })
})

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`AquaFlow server listening on http://127.0.0.1:${PORT}`)
})
