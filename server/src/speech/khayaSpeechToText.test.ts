import { afterEach, describe, expect, it, vi } from 'vitest'
import { KhayaSpeechToTextProvider } from './khayaSpeechToText.js'

const wav = Buffer.alloc(200, 1)

describe('KhayaSpeechToTextProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns Khaya text only when the transcript is present', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ text: 'How much water do I have?' }),
      }),
    )
    const provider = new KhayaSpeechToTextProvider({ key: 'test-key' })
    const result = await provider.transcribe(wav, 'audio/wav')
    expect(result).toEqual({ ok: true, text: 'How much water do I have?' })

    const [calledUrl, init] = vi.mocked(fetch).mock.calls[0] ?? []
    expect(String(calledUrl)).toContain('translation-api.ghananlp.org/asr/v3/transcribe')
    expect(String(calledUrl)).toContain('language=eng')
    expect(String(calledUrl)).not.toMatch(/microsoft|azure|cognitiveservices/i)
    expect((init as RequestInit | undefined)?.headers).toMatchObject({
      'Ocp-Apim-Subscription-Key': 'test-key',
      'Content-Type': 'audio/wav',
    })
  })

  it('does not guess when Khaya returns empty text', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ text: '' }),
      }),
    )
    const provider = new KhayaSpeechToTextProvider({ key: 'test-key' })
    const result = await provider.transcribe(wav, 'audio/wav')
    expect(result.ok).toBe(false)
    expect(result.text).toBeUndefined()
    expect(result.reason).toMatch(/try again/i)
  })

  it('does not guess when Khaya returns an error status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: { message: 'VALIDATION_FAILED' } }),
      }),
    )
    const provider = new KhayaSpeechToTextProvider({ key: 'test-key' })
    const result = await provider.transcribe(wav, 'audio/wav')
    expect(result.ok).toBe(false)
    expect(result.text).toBeUndefined()
    expect(result.reason).toMatch(/try again/i)
  })

  it('does not guess when the recording is too short', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const provider = new KhayaSpeechToTextProvider({ key: 'test-key' })
    const result = await provider.transcribe(Buffer.alloc(10), 'audio/wav')
    expect(result.ok).toBe(false)
    expect(result.text).toBeUndefined()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
