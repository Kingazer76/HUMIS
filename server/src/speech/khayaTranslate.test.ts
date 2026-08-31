import { afterEach, describe, expect, it, vi } from 'vitest'
import { translateWithKhaya } from './khayaTranslate.js'

describe('translateWithKhaya', () => {
  const previous = process.env.KHAYA_API_KEY

  afterEach(() => {
    vi.unstubAllGlobals()
    if (previous === undefined) delete process.env.KHAYA_API_KEY
    else process.env.KHAYA_API_KEY = previous
  })

  it('posts v2 translate with in and lang and never invents text', async () => {
    process.env.KHAYA_API_KEY = 'env-test-translate-key'
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => 'Nsu dodow ahe na ɛwɔ tank no mu?',
      }),
    )
    const text = await translateWithKhaya('How much water is in the tank?', 'eng-twi')
    expect(text).toBe('Nsu dodow ahe na ɛwɔ tank no mu?')
    const [url, init] = vi.mocked(fetch).mock.calls[0] ?? []
    expect(String(url)).toContain('/v2/translate')
    expect((init as RequestInit | undefined)?.headers).toMatchObject({
      'Ocp-Apim-Subscription-Key': 'env-test-translate-key',
    })
    expect(JSON.parse(String((init as RequestInit | undefined)?.body))).toEqual({
      in: 'How much water is in the tank?',
      lang: 'eng-twi',
    })
  })

  it('returns nothing when Khaya translation fails', async () => {
    process.env.KHAYA_API_KEY = 'env-test-translate-key'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }))
    const text = await translateWithKhaya('How much water is in the tank?', 'eng-twi')
    expect(text).toBeUndefined()
  })
})
