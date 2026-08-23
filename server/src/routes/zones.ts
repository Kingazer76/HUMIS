import { Router } from 'express'
import { deviceProvider } from '../providers/index.js'

export const zonesRouter = Router()

zonesRouter.get('/', async (_req, res, next) => {
  try {
    const zones = await deviceProvider.getZones()
    res.json(zones)
  } catch (error) {
    next(error)
  }
})
