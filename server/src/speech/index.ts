import { getKhayaApiKey, KHAYA_ASR_LANGUAGE, KHAYA_ASR_URL, KHAYA_TTS_LANGUAGE, KHAYA_TTS_SPEAKER, KHAYA_TTS_URL } from '../env.js'
import { KhayaSpeechToTextProvider } from './khayaSpeechToText.js'
import { KhayaTextToSpeechProvider } from './khayaTextToSpeech.js'
import type { SpeechToTextProvider } from './speechToTextProvider.js'
import type { TextToSpeechProvider } from './textToSpeechProvider.js'
import { UnavailableSpeechToTextProvider } from './unavailableSpeechToText.js'
import { UnavailableTextToSpeechProvider } from './unavailableTextToSpeech.js'

export type { SpeechToTextProvider } from './speechToTextProvider.js'
export type { TextToSpeechProvider } from './textToSpeechProvider.js'

function createSpeechToTextProvider(): SpeechToTextProvider {
  const key = getKhayaApiKey()
  if (key) {
    return new KhayaSpeechToTextProvider({
      key,
      language: KHAYA_ASR_LANGUAGE,
      transcribeUrl: KHAYA_ASR_URL,
    })
  }
  return new UnavailableSpeechToTextProvider()
}

function createTextToSpeechProvider(): TextToSpeechProvider {
  const key = getKhayaApiKey()
  if (key) {
    return new KhayaTextToSpeechProvider({
      key,
      language: KHAYA_TTS_LANGUAGE,
      synthesizeUrl: KHAYA_TTS_URL,
      speaker: KHAYA_TTS_SPEAKER,
    })
  }
  return new UnavailableTextToSpeechProvider()
}

let speechOverride: SpeechToTextProvider | null = null
let voiceOverride: TextToSpeechProvider | null = null

export function getSpeechToTextProvider(): SpeechToTextProvider {
  return speechOverride ?? createSpeechToTextProvider()
}

export function getTextToSpeechProvider(): TextToSpeechProvider {
  return voiceOverride ?? createTextToSpeechProvider()
}

/** Test isolation — production always uses the create* helpers. */
export function setSpeechToTextProviderForTests(provider: SpeechToTextProvider | null): void {
  speechOverride = provider
}

export function setTextToSpeechProviderForTests(provider: TextToSpeechProvider | null): void {
  voiceOverride = provider
}
