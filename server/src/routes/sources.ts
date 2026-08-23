import { Router } from 'express'
import { deviceProvider } from '../providers/index.js'

export const sourcesRouter = Router()

sourcesRouter.get('/', async (_req, res, next) => {
  try {
    const sources = await deviceProvider.getSources()
    res.json(sources)
  } catch (error) {
    next(error)
  }
})
