import { describe, expect, it } from 'vitest'
import { UnavailableSpeechToTextProvider } from './unavailableSpeechToText.js'

describe('UnavailableSpeechToTextProvider', () => {
  it('never invents a transcript', async () => {
    const result = await new UnavailableSpeechToTextProvider().transcribe(Buffer.alloc(500), 'audio/wav')
    expect(result.ok).toBe(false)
    expect(result.text).toBeUndefined()
    expect(result.reason).toMatch(/KHAYA_API_KEY/)
  })
})
