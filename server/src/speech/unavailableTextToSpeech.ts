import { VOICE_MESSAGES } from '@aquaflow/shared'
import type { TextToSpeechProvider, TextToSpeechResult } from './textToSpeechProvider.js'

/**
 * Used when Khaya TTS is not configured. Never invents audio.
 * The written assistant answer must stay on screen.
 */
export class UnavailableTextToSpeechProvider implements TextToSpeechProvider {
  async speak(_text: string, _language?: string): Promise<TextToSpeechResult> {
    return {
      ok: false,
      reason: VOICE_MESSAGES.speakFailed,
    }
  }
}
