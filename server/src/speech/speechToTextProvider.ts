import type { SpeechToTextResponse } from '@aquaflow/shared'

/**
 * Replaceable speech-to-text seam. Azure is the Phase 8A provider.
 * Khaya or another service can implement this later without changing chat.
 */
export interface SpeechToTextProvider {
  transcribe(audio: Buffer, contentType: string): Promise<SpeechToTextResponse>
}
