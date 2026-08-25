import { Router } from 'express'
import { historyLog } from '../history/historyLog.js'

export const historyRouter = Router()

historyRouter.get('/', (_req, res) => {
  res.json({ records: historyLog.list() })
})
