import { toFarmerVoiceMessage, VOICE_MESSAGES } from '@aquaflow/shared'
import type { Request, Response, NextFunction } from 'express'
import { Router } from 'express'
import { handleAssistantMessage } from '../assistant/handleMessage.js'
import { getSpeechToTextProvider, getTextToSpeechProvider } from '../speech/index.js'

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
      res.json({
        ok: false,
        reason: toFarmerVoiceMessage(result.reason, VOICE_MESSAGES.couldNotUnderstand),
      })
      return
    }
    res.json({ ok: true, text: result.text.trim() })
  } catch (error) {
    next(error)
  }
}

/**
 * Text-to-speech only. Speaks the exact assistant reply.
 * This route never calls the safety controller, farm math, or chat.
 */
export async function speakReply(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const text = req.body?.text
    if (typeof text !== 'string') {
      res.status(400).json({ ok: false, reason: VOICE_MESSAGES.generic })
      return
    }
    const result = await getTextToSpeechProvider().speak(text)
    if (!result.ok || !result.audio) {
      res.json({
        ok: false,
        reason: toFarmerVoiceMessage(result.reason, VOICE_MESSAGES.speakFailed),
      })
      return
    }
    res.setHeader('Content-Type', result.contentType ?? 'audio/wav')
    res.send(result.audio)
  } catch (error) {
    next(error)
  }
}

assistantRouter.post('/speak', speakReply)
