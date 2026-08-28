import type { IrrigationAdviceSnapshot, OperationMode } from '@aquaflow/shared'
import { Router } from 'express'
import { buildIrrigationAdvice } from '../irrigation/buildIrrigationAdvice.js'
import { safetyController } from '../irrigation/safetyController.js'

export const irrigationRouter = Router()

/**
 * Every mutating route here does nothing but validate the request shape and
 * hand off to `safetyController`. GET /advice is read-only: it uses the
 * same decideZoneIrrigation function Auto mode uses, and never opens valves.
 */

irrigationRouter.get('/advice', async (_req, res, next) => {
  try {
    const snapshot: IrrigationAdviceSnapshot = await buildIrrigationAdvice()
    res.json(snapshot)
  } catch (error) {
    next(error)
  }
})

irrigationRouter.post('/:zoneId/start', async (req, res, next) => {
  try {
    const result = await safetyController.setZoneActive(req.params.zoneId, true, 'manual')
    res.json(result)
  } catch (error) {
    next(error)
  }
})

irrigationRouter.post('/:zoneId/stop', async (req, res, next) => {
  try {
    const result = await safetyController.setZoneActive(req.params.zoneId, false, 'manual')
    res.json(result)
  } catch (error) {
    next(error)
  }
})

irrigationRouter.post('/pump', async (req, res, next) => {
  try {
    const isOn = req.body?.isOn
    if (typeof isOn !== 'boolean') {
      res.status(400).json({ ok: false, reason: 'Request body must include a boolean "isOn"' })
      return
    }
    const result = await safetyController.setPumpState(isOn)
    res.json(result)
  } catch (error) {
    next(error)
  }
})

irrigationRouter.post('/mode', async (req, res, next) => {
  try {
    const mode = req.body?.mode as OperationMode | undefined
    if (mode !== 'auto' && mode !== 'manual') {
      res.status(400).json({ ok: false, reason: 'Request body must include mode "auto" or "manual"' })
      return
    }
    const result = await safetyController.setOperationMode(mode)
    res.json(result)
  } catch (error) {
    next(error)
  }
})
