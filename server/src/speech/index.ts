import { KHAYA_API_KEY, KHAYA_ASR_LANGUAGE, KHAYA_ASR_URL } from '../env.js'
import { KhayaSpeechToTextProvider } from './khayaSpeechToText.js'
import type { SpeechToTextProvider } from './speechToTextProvider.js'
import { UnavailableSpeechToTextProvider } from './unavailableSpeechToText.js'

export type { SpeechToTextProvider } from './speechToTextProvider.js'

function createSpeechToTextProvider(): SpeechToTextProvider {
  const key = KHAYA_API_KEY.trim()
  if (key) {
    return new KhayaSpeechToTextProvider({
      key,
      language: KHAYA_ASR_LANGUAGE,
      transcribeUrl: KHAYA_ASR_URL,
    })
  }
  return new UnavailableSpeechToTextProvider()
}

let current: SpeechToTextProvider = createSpeechToTextProvider()

export function getSpeechToTextProvider(): SpeechToTextProvider {
  return current
}

/** Test isolation — production always uses `createSpeechToTextProvider()`. */
export function setSpeechToTextProviderForTests(provider: SpeechToTextProvider | null): void {
  current = provider ?? createSpeechToTextProvider()
}
