import { AZURE_SPEECH_KEY, AZURE_SPEECH_LOCALE, AZURE_SPEECH_REGION } from '../env.js'
import { AzureSpeechToTextProvider } from './azureSpeechToText.js'
import type { SpeechToTextProvider } from './speechToTextProvider.js'
import { UnavailableSpeechToTextProvider } from './unavailableSpeechToText.js'

export type { SpeechToTextProvider } from './speechToTextProvider.js'

function createSpeechToTextProvider(): SpeechToTextProvider {
  const key = AZURE_SPEECH_KEY.trim()
  const region = AZURE_SPEECH_REGION.trim()
  if (key && region) {
    return new AzureSpeechToTextProvider({
      key,
      region,
      locale: AZURE_SPEECH_LOCALE.trim() || 'en-GH',
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
