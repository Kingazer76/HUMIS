import { afterEach, describe, expect, it, vi } from 'vitest'
import { AzureSpeechToTextProvider } from './azureSpeechToText.js'

const wav = Buffer.alloc(200, 1)

describe('AzureSpeechToTextProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns DisplayText only when Azure reports Success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ RecognitionStatus: 'Success', DisplayText: 'How much water do I have?' }),
      }),
    )
    const provider = new AzureSpeechToTextProvider({ key: 'test-key', region: 'eastus', locale: 'en-GH' })
    const result = await provider.transcribe(wav, 'audio/wav')
    expect(result).toEqual({ ok: true, text: 'How much water do I have?' })
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toContain('language=en-GH')
  })

  it('does not guess when Azure reports NoMatch', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ RecognitionStatus: 'NoMatch', DisplayText: '' }),
      }),
    )
    const provider = new AzureSpeechToTextProvider({ key: 'test-key', region: 'eastus', locale: 'en-GH' })
    const result = await provider.transcribe(wav, 'audio/wav')
    expect(result.ok).toBe(false)
    expect(result.text).toBeUndefined()
    expect(result.reason).toMatch(/try again/i)
  })

  it('does not guess when the recording is too short', async () => {
    const provider = new AzureSpeechToTextProvider({ key: 'test-key', region: 'eastus', locale: 'en-GH' })
    const result = await provider.transcribe(Buffer.alloc(10), 'audio/wav')
    expect(result.ok).toBe(false)
    expect(result.text).toBeUndefined()
  })
})
