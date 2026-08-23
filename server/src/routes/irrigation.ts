import type { OperationMode } from '@aquaflow/shared'
import { Router } from 'express'
import { safetyController } from '../irrigation/safetyController.js'

export const irrigationRouter = Router()

/**
 * Every route here does nothing but validate the request shape and hand
 * off to `safetyController` — none of them touch `DeviceProvider` directly,
 * and none of them contain any irrigation decision logic themselves.
 * `ok: false` responses are expected, normal outcomes (a safety interlock
 * rejected the action), not server errors.
 */

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
