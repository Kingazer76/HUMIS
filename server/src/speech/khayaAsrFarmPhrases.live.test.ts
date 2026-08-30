import { describe, expect, it } from 'vitest'
import { getKhayaApiKey } from '../env.js'
import { KhayaSpeechToTextProvider } from './khayaSpeechToText.js'
import { KhayaTextToSpeechProvider } from './khayaTextToSpeech.js'

const phrases = [
  'Turn on the pump.',
  'Turn off the pump.',
  'Start irrigation.',
  'Stop irrigation.',
  'How much water is in the tank?',
  'Should I irrigate now?',
  'Is the soil dry?',
]

/**
 * Optional live check: Khaya TTS v2 speaks a farm phrase, then ASR v3
 * transcribes that audio. Off unless KHAYA_LIVE_ASR=1 so normal tests stay
 * offline. This is not a microphone test — it only records what ASR hears
 * from Khaya's own voice.
 */
describe.skipIf(process.env.KHAYA_LIVE_ASR !== '1')('Khaya ASR live farm phrases', () => {
  it('records ASR text for spoken farm phrases without printing the API key', async () => {
    const key = getKhayaApiKey()
    expect(key.length).toBeGreaterThan(8)

    const tts = new KhayaTextToSpeechProvider({ key })
    const asr = new KhayaSpeechToTextProvider({ key })
    const results: { said: string; heard: string }[] = []

    for (const said of phrases) {
      const spoken = await tts.speak(said)
      expect(spoken.ok).toBe(true)
      if (!spoken.ok) continue
      const heard = await asr.transcribe(spoken.audio, spoken.contentType)
      results.push({
        said,
        heard: heard.ok ? (heard.text ?? '') : `failed: ${heard.reason ?? 'unknown'}`,
      })
    }

    // Farmer-facing report only — never log subscription headers or the key.
    console.log(JSON.stringify(results, null, 2))
    expect(results).toHaveLength(phrases.length)
  }, 120_000)
})
