import type { SystemSnapshot } from '@aquaflow/shared'
import { Router } from 'express'
import { deviceProvider } from '../providers/index.js'

export const systemRouter = Router()

/**
 * Read-only sensor/actuator status (rain, pump, system phase). No route in
 * Phase 1 accepts a write here — turning the pump or a valve on/off is
 * introduced in Phase 3, and only through `safetyController`.
 */
systemRouter.get('/', async (_req, res, next) => {
  try {
    const [rain, pump, system] = await Promise.all([
      deviceProvider.getRainStatus(),
      deviceProvider.getPumpStatus(),
      deviceProvider.getSystemStatus(),
    ])
    const snapshot: SystemSnapshot = { rain, pump, system }
    res.json(snapshot)
  } catch (error) {
    next(error)
  }
})
