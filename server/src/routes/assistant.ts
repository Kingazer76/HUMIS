import { Router } from 'express'
import { handleAssistantMessage } from '../assistant/handleMessage.js'

export const assistantRouter = Router()

/**
 * Text chat for the AquaFlow Assistant. Questions read the same farm
 * numbers as the dashboard. Watering commands only go through
 * `safetyController` — never `DeviceProvider` directly.
 */
assistantRouter.post('/chat', async (req, res, next) => {
  try {
    const message = req.body?.message
    if (typeof message !== 'string') {
      res.status(400).json({ ok: false, reason: 'Request body must include a string "message"' })
      return
    }
    const trimmed = message.trim()
    if (!trimmed) {
      res.json({
        reply: 'Please type a question about your water or fields, or ask me to start or stop watering.',
      })
      return
    }
    const result = await handleAssistantMessage(trimmed)
    res.json(result)
  } catch (error) {
    next(error)
  }
})
