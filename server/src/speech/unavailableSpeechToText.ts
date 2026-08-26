import type { SpeechToTextResponse } from '@aquaflow/shared'
import type { SpeechToTextProvider } from './speechToTextProvider.js'

/**
 * Used when Khaya ASR is not configured. Never invents a transcript.
 */
export class UnavailableSpeechToTextProvider implements SpeechToTextProvider {
  async transcribe(_audio: Buffer, _contentType: string): Promise<SpeechToTextResponse> {
    return {
      ok: false,
      reason:
        'Speech listening is not set up yet. Add KHAYA_API_KEY on the server, then try again.',
    }
  }
}
