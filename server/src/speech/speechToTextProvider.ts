import type { SpeechToTextResponse } from '@aquaflow/shared'

/**
 * Replaceable speech-to-text seam. Khaya ASR is the Phase 8A provider.
 * Chat still receives plain text — swapping this does not change the assistant.
 */
export interface SpeechToTextProvider {
  transcribe(audio: Buffer, contentType: string): Promise<SpeechToTextResponse>
}
