import type { TextToSpeechProvider, TextToSpeechResult } from './textToSpeechProvider.js'

/**
 * Used when Khaya TTS is not configured. Never invents audio.
 * The written assistant answer must stay on screen.
 */
export class UnavailableTextToSpeechProvider implements TextToSpeechProvider {
  async speak(_text: string): Promise<TextToSpeechResult> {
    return {
      ok: false,
      reason:
        "Couldn't speak that. Add KHAYA_API_KEY on the server. The written answer is still on screen.",
    }
  }
}
