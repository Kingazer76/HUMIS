import { VOICE_MESSAGES, type SpeechToTextResponse } from '@aquaflow/shared'
import type { SpeechToTextProvider } from './speechToTextProvider.js'

/**
 * Used when Khaya ASR is not configured. Never invents a transcript.
 * The farmer sees a simple type-instead message — not the key name.
 */
export class UnavailableSpeechToTextProvider implements SpeechToTextProvider {
  async transcribe(_audio: Buffer, _contentType: string): Promise<SpeechToTextResponse> {
    return {
      ok: false,
      reason: VOICE_MESSAGES.voiceNotReady,
    }
  }
}
