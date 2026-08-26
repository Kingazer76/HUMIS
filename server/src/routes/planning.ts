import { Router } from 'express'
import { buildPlanningSnapshot } from '../forecast/buildPlanningSnapshot.js'

export const planningRouter = Router()

planningRouter.get('/', async (_req, res, next) => {
  try {
    // Never lets a weather failure block planning — see getForecastSafely.
    res.json(await buildPlanningSnapshot())
  } catch (error) {
    next(error)
  }
})
