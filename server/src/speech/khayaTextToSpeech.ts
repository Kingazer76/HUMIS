import { resolveKhayaLanguage, VOICE_MESSAGES } from '@aquaflow/shared'
import type { TextToSpeechProvider, TextToSpeechResult } from './textToSpeechProvider.js'

const DEFAULT_URL = 'https://translation-api.ghananlp.org/tts/v2/synthesize'
const RIFF = Buffer.from('RIFF')

/**
 * Khaya AI Text-to-Speech (TTS v2).
 * Keys stay on the server. The reply text is sent unchanged.
 * Ghanaian-language switching is per request. African English (`eng`)
 * remains the default when no language is given.
 */
export class KhayaTextToSpeechProvider implements TextToSpeechProvider {
  constructor(
    private readonly options: {
      key: string
      language?: string
      synthesizeUrl?: string
      speaker?: string
    },
  ) {}

  async speak(text: string, languageOverride?: string): Promise<TextToSpeechResult> {
    if (typeof text !== 'string' || text.trim().length === 0) {
      return { ok: false, reason: VOICE_MESSAGES.speakFailed }
    }

    const language = resolveKhayaLanguage(languageOverride ?? this.options.language)
    const url = this.options.synthesizeUrl?.trim() || DEFAULT_URL
    const speaker = this.options.speaker?.trim()
    const payload: { text: string; language: string; format: string; speaker_id?: string } = {
      text,
      language,
      format: 'wav',
    }
    if (speaker) payload.speaker_id = speaker

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': this.options.key,
          Accept: 'audio/wav',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const bytes = Buffer.from(await res.arrayBuffer())
      if (!res.ok || !isAudioPayload(res.headers.get('content-type') ?? '', bytes)) {
        return { ok: false, reason: VOICE_MESSAGES.speakFailed }
      }
      return {
        ok: true,
        audio: bytes,
        contentType: audioContentType(res.headers.get('content-type') ?? ''),
      }
    } catch {
      return { ok: false, reason: VOICE_MESSAGES.noInternet }
    }
  }
}

function isAudioPayload(contentType: string, body: Buffer): boolean {
  if (body.byteLength < 12) return false
  if (contentType.toLowerCase().includes('json')) return false
  if (contentType.toLowerCase().startsWith('audio/')) return true
  return body.subarray(0, 4).equals(RIFF)
}

function audioContentType(contentType: string): string {
  const type = contentType.split(';')[0]?.trim().toLowerCase() ?? ''
  if (type.startsWith('audio/')) return type
  return 'audio/wav'
}
