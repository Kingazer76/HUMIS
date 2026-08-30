import { describe, expect, it } from 'vitest'
import { UnavailableTextToSpeechProvider } from './unavailableTextToSpeech.js'

describe('UnavailableTextToSpeechProvider', () => {
  it('never invents audio', async () => {
    const result = await new UnavailableTextToSpeechProvider().speak('Water level is good.')
    expect(result.ok).toBe(false)
    expect(result.audio).toBeUndefined()
    expect(result.reason).toMatch(/written answer is still on screen/i)
    expect(result.reason).not.toMatch(/KHAYA_API_KEY|tts|http/i)
  })
})
