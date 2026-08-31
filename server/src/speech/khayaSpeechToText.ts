import {
  resolveKhayaLanguage,
  VOICE_MESSAGES,
  type SpeechToTextResponse,
} from '@aquaflow/shared'
import type { SpeechToTextProvider } from './speechToTextProvider.js'

const DEFAULT_URL = 'https://translation-api.ghananlp.org/asr/v3/transcribe'

/**
 * Khaya AI Automatic Speech Recognition (ASR v3).
 * Keys stay on the server. This layer only turns audio into text.
 * Ghanaian-language switching is per request. African English (`eng`)
 * remains the default when no language is given.
 *
 * The public ASR v3 request is the audio body plus `language`. There is no
 * documented vocabulary, phrase-hint, or farm-domain field. Do not invent one.
 */
export class KhayaSpeechToTextProvider implements SpeechToTextProvider {
  constructor(
    private readonly options: {
      key: string
      language?: string
      transcribeUrl?: string
    },
  ) {}

  async transcribe(
    audio: Buffer,
    contentType: string,
    languageOverride?: string,
  ): Promise<SpeechToTextResponse> {
    if (audio.byteLength < 100) {
      return { ok: false, reason: VOICE_MESSAGES.couldNotHear }
    }

    const language = resolveKhayaLanguage(languageOverride ?? this.options.language)
    const url = new URL(this.options.transcribeUrl?.trim() || DEFAULT_URL)
    url.searchParams.set('language', language)
    // Only `language` is a supported query field. No hints / boost / glossary.

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
        return { ok: false, reason: VOICE_MESSAGES.couldNotUnderstand }
      }

      const text = extractTranscript(await res.json())
      if (!text) {
        return { ok: false, reason: VOICE_MESSAGES.couldNotUnderstand }
      }
      return { ok: true, text }
    } catch {
      return { ok: false, reason: VOICE_MESSAGES.noInternet }
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
