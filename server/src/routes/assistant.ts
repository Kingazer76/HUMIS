import type { Request, Response, NextFunction } from 'express'
import { Router } from 'express'
import { handleAssistantMessage } from '../assistant/handleMessage.js'
import { getSpeechToTextProvider } from '../speech/index.js'

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

const RETRY = "I didn't catch that. Tap the microphone and try again."

/**
 * Speech-to-text only. The browser then sends `text` to `/chat`.
 * This route never calls the safety controller or farm math.
 */
export async function transcribeSpeech(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const audio = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0)
    const contentType = String(req.headers['content-type'] ?? 'application/octet-stream')
    const result = await getSpeechToTextProvider().transcribe(audio, contentType)
    if (!result.ok || !result.text?.trim()) {
      res.json({ ok: false, reason: result.reason ?? RETRY })
      return
    }
    res.json({ ok: true, text: result.text.trim() })
  } catch (error) {
    next(error)
  }
}
