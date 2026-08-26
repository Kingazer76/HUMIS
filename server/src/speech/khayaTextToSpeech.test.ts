import { afterEach, describe, expect, it, vi } from 'vitest'
import { KhayaTextToSpeechProvider } from './khayaTextToSpeech.js'

const wav = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(36, 1)])

describe('KhayaTextToSpeechProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends the exact assistant text to Khaya TTS and returns audio', async () => {
    const reply = 'Water level is good. 9,000 L in the tank.'
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'audio/wav' },
        arrayBuffer: async () => wav.buffer.slice(wav.byteOffset, wav.byteOffset + wav.byteLength),
      }),
    )
    const provider = new KhayaTextToSpeechProvider({ key: 'test-key' })
    const result = await provider.speak(reply)
    expect(result.ok).toBe(true)
    expect(result.audio?.equals(wav)).toBe(true)
    expect(result.contentType).toBe('audio/wav')

    const [calledUrl, init] = vi.mocked(fetch).mock.calls[0] ?? []
    expect(String(calledUrl)).toContain('translation-api.ghananlp.org/tts/v2/synthesize')
    expect(String(calledUrl)).not.toMatch(/microsoft|azure|cognitiveservices/i)
    expect((init as RequestInit | undefined)?.headers).toMatchObject({
      'Ocp-Apim-Subscription-Key': 'test-key',
      'Content-Type': 'application/json',
    })
    expect(JSON.parse(String((init as RequestInit | undefined)?.body))).toEqual({
      text: reply,
      language: 'eng',
      format: 'wav',
    })
  })

  it('does not invent audio when Khaya returns an error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        headers: { get: () => 'application/json' },
        arrayBuffer: async () => Buffer.from('{"error":{"message":"SYSTEM_ERROR"}}'),
      }),
    )
    const provider = new KhayaTextToSpeechProvider({ key: 'test-key' })
    const result = await provider.speak('How much water do I have?')
    expect(result.ok).toBe(false)
    expect(result.audio).toBeUndefined()
    expect(result.reason).toMatch(/written answer is still on screen/i)
  })

  it('does not call Khaya with blank text', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const provider = new KhayaTextToSpeechProvider({ key: 'test-key' })
    const result = await provider.speak('   ')
    expect(result.ok).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
