/**
 * Replaceable text-to-speech seam. Khaya TTS is the Phase 8B provider.
 * The assistant reply is spoken as-is — this layer never rewrites farm answers.
 */
export interface TextToSpeechResult {
  ok: boolean
  audio?: Buffer
  contentType?: string
  reason?: string
}

export interface TextToSpeechProvider {
  speak(text: string): Promise<TextToSpeechResult>
}
