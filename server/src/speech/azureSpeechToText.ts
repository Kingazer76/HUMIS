import type { SpeechToTextResponse } from '@aquaflow/shared'
import type { SpeechToTextProvider } from './speechToTextProvider.js'

const RETRY = "I didn't catch that. Tap the microphone and try again."

/**
 * Azure Speech REST (short audio) with Ghanaian English (`en-GH`) by default.
 * Keys stay on the server.
 */
export class AzureSpeechToTextProvider implements SpeechToTextProvider {
  constructor(
    private readonly options: {
      key: string
      region: string
      locale: string
    },
  ) {}

  async transcribe(audio: Buffer, contentType: string): Promise<SpeechToTextResponse> {
    if (audio.byteLength < 100) {
      return { ok: false, reason: RETRY }
    }

    const locale = this.options.locale || 'en-GH'
    const url = `https://${this.options.region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${encodeURIComponent(locale)}&format=simple`
    const wav = contentType.includes('wav') || contentType.includes('pcm')
    const azureType = wav ? 'audio/wav; codecs=audio/pcm; samplerate=16000' : contentType

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': this.options.key,
          Accept: 'application/json',
          'Content-Type': azureType,
        },
        body: audio,
      })

      if (!res.ok) {
        return { ok: false, reason: RETRY }
      }

      const body = (await res.json()) as { RecognitionStatus?: string; DisplayText?: string }
      const text = body.DisplayText?.trim() ?? ''
      if (body.RecognitionStatus === 'Success' && text.length > 0) {
        return { ok: true, text }
      }
      return { ok: false, reason: RETRY }
    } catch {
      return { ok: false, reason: RETRY }
    }
  }
}
