import type { SpeechToTextResponse } from '@aquaflow/shared'
import type { SpeechToTextProvider } from './speechToTextProvider.js'

const RETRY = "I didn't catch that. Tap the microphone and try again."
const DEFAULT_URL = 'https://translation-api.ghananlp.org/asr/v3/transcribe'
const DEFAULT_LANGUAGE = 'eng'

/**
 * Khaya AI Automatic Speech Recognition (ASR v3).
 * Keys stay on the server. Ghanaian-language switching is Phase 8C —
 * Phase 8A listens in African English (`eng`).
 */
export class KhayaSpeechToTextProvider implements SpeechToTextProvider {
  constructor(
    private readonly options: {
      key: string
      language?: string
      transcribeUrl?: string
    },
  ) {}

  async transcribe(audio: Buffer, contentType: string): Promise<SpeechToTextResponse> {
    if (audio.byteLength < 100) {
      return { ok: false, reason: RETRY }
    }

    const language = this.options.language?.trim() || DEFAULT_LANGUAGE
    const url = new URL(this.options.transcribeUrl?.trim() || DEFAULT_URL)
    url.searchParams.set('language', language)

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': this.options.key,
          Accept: 'application/json',
          'Content-Type': khayaAudioType(contentType),
        },
        body: new Uint8Array(audio),
      })

      if (!res.ok) {
        return { ok: false, reason: RETRY }
      }

      const text = extractTranscript(await res.json())
      if (!text) {
        return { ok: false, reason: RETRY }
      }
      return { ok: true, text }
    } catch {
      return { ok: false, reason: RETRY }
    }
  }
}

function khayaAudioType(contentType: string): string {
  const type = contentType.toLowerCase()
  if (type.includes('mpeg') || type.includes('mp3')) return 'audio/mpeg'
  if (type.includes('flac')) return 'audio/flac'
  if (type.includes('ogg')) return 'audio/ogg'
  return 'audio/wav'
}

/** v3 returns `{ text }`. v1 returns a bare JSON string. Never invent words. */
function extractTranscript(body: unknown): string | undefined {
  if (typeof body === 'string') {
    const text = body.trim()
    return text.length > 0 ? text : undefined
  }
  if (body && typeof body === 'object' && 'text' in body) {
    const value = (body as { text?: unknown }).text
    if (typeof value === 'string') {
      const text = value.trim()
      return text.length > 0 ? text : undefined
    }
  }
  return undefined
}
