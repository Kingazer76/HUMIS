import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { resetFarmSettingsForTests } from '../config/farmSettings.js'
import { simulatedProvider } from '../providers/index.js'
import { setSpeechToTextProviderForTests, setTextToSpeechProviderForTests } from './index.js'

const app = createApp()
const wav = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(36, 1)])

function restoreEnv(name: string, previous: string | undefined) {
  if (previous === undefined) delete process.env[name]
  else process.env[name] = previous
}

describe('shared Khaya API key', () => {
  const previousShared = process.env.KHAYA_API_KEY
  const previousAsr = process.env.KHAYA_ASR_API_KEY
  const previousTts = process.env.KHAYA_TTS_API_KEY

  beforeEach(() => {
    resetFarmSettingsForTests()
    simulatedProvider?.resetForTests()
    setSpeechToTextProviderForTests(null)
    setTextToSpeechProviderForTests(null)
    delete process.env.KHAYA_API_KEY
    delete process.env.KHAYA_ASR_API_KEY
    delete process.env.KHAYA_TTS_API_KEY
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    setSpeechToTextProviderForTests(null)
    setTextToSpeechProviderForTests(null)
    restoreEnv('KHAYA_API_KEY', previousShared)
    restoreEnv('KHAYA_ASR_API_KEY', previousAsr)
    restoreEnv('KHAYA_TTS_API_KEY', previousTts)
    resetFarmSettingsForTests()
    simulatedProvider?.resetForTests()
  })

  it('sends the same KHAYA_API_KEY to ASR v3 and TTS v2', async () => {
    process.env.KHAYA_API_KEY = 'env-test-shared-key'
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL) => {
        const href = String(url)
        if (href.includes('/asr/v3/transcribe')) {
          return { ok: true, json: async () => ({ text: 'How much water do I have?' }) }
        }
        return {
          ok: true,
          headers: { get: () => 'audio/wav' },
          arrayBuffer: async () => wav.buffer.slice(wav.byteOffset, wav.byteOffset + wav.byteLength),
        }
      }),
    )

    const spoken = await request(app)
      .post('/api/assistant/speech')
      .set('Content-Type', 'audio/wav')
      .send(Buffer.alloc(256, 1))
    const voiced = await request(app).post('/api/assistant/speak').send({ text: 'Water level is good.' })

    expect(spoken.body).toEqual({ ok: true, text: 'How much water do I have?' })
    expect(voiced.status).toBe(200)
    expect(voiced.headers['content-type']).toMatch(/audio\/wav/)

    const calls = vi.mocked(fetch).mock.calls
    const asr = calls.find(([url]) => String(url).includes('/asr/v3/transcribe'))
    const tts = calls.find(([url]) => String(url).includes('/tts/v2/synthesize'))
    expect(asr).toBeTruthy()
    expect(tts).toBeTruthy()
    expect(String(asr?.[0])).not.toMatch(/asr\/v1/i)
    expect(String(tts?.[0])).not.toMatch(/tts\/v1/i)
    expect((asr?.[1] as RequestInit | undefined)?.headers).toMatchObject({
      'Ocp-Apim-Subscription-Key': 'env-test-shared-key',
    })
    expect((tts?.[1] as RequestInit | undefined)?.headers).toMatchObject({
      'Ocp-Apim-Subscription-Key': 'env-test-shared-key',
    })
  })

  it('does not use KHAYA_ASR_API_KEY or KHAYA_TTS_API_KEY', async () => {
    process.env.KHAYA_ASR_API_KEY = 'env-test-asr-key'
    process.env.KHAYA_TTS_API_KEY = 'env-test-tts-key'
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const spoken = await request(app)
      .post('/api/assistant/speech')
      .set('Content-Type', 'audio/wav')
      .send(Buffer.alloc(256, 1))
    const voiced = await request(app).post('/api/assistant/speak').send({ text: 'Water level is good.' })

    expect(spoken.body.ok).toBe(false)
    expect(voiced.body.ok).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
