import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAuthedAgent } from './test/authedAgent.js'
import { createApp } from './app.js'
import { resetFarmSettingsForTests } from './config/farmSettings.js'
import { simulatedProvider } from './providers/index.js'
import { setSpeechToTextProviderForTests } from './speech/index.js'
import type { SpeechToTextProvider } from './speech/speechToTextProvider.js'
import { UnavailableSpeechToTextProvider } from './speech/unavailableSpeechToText.js'

const app = createApp()
const agent = await createAuthedAgent(app)
const silentWav = Buffer.alloc(256, 0)

beforeEach(() => {
  resetFarmSettingsForTests()
  simulatedProvider?.resetForTests()
})

afterEach(() => {
  setSpeechToTextProviderForTests(null)
  resetFarmSettingsForTests()
  simulatedProvider?.resetForTests()
})

describe('POST /api/assistant/speech', () => {
  it('returns recognized text from the speech provider and does not invent words', async () => {
    const fake: SpeechToTextProvider = {
      transcribe: async () => ({ ok: true, text: 'How much water do I have?' }),
    }
    setSpeechToTextProviderForTests(fake)

    const res = await agent.post('/api/assistant/speech').set('Content-Type', 'audio/wav').send(silentWav)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true, text: 'How much water do I have?' })
  })

  it('asks the farmer to retry when speech is unclear', async () => {
    setSpeechToTextProviderForTests({
      transcribe: async () => ({ ok: false, reason: "I didn't catch that. Tap the microphone and try again." }),
    })

    const res = await agent.post('/api/assistant/speech').set('Content-Type', 'audio/wav').send(silentWav)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(false)
    expect(res.body.text).toBeUndefined()
    expect(res.body.reason).toMatch(/try again/i)
  })

  it('sends the recognized sentence through the existing chat path', async () => {
    setSpeechToTextProviderForTests({
      transcribe: async () => ({ ok: true, text: 'How much water do I have?' }),
    })
    const spoken = await agent.post('/api/assistant/speech').set('Content-Type', 'audio/wav').send(silentWav)
    expect(spoken.body.ok).toBe(true)

    const chat = await agent.post('/api/assistant/chat').send({ message: spoken.body.text })
    expect(chat.status).toBe(200)
    expect(chat.body.reply).toMatch(/L/)
    expect(chat.body.reply.toLowerCase()).toMatch(/tank|water level/)
  })

  it('sends a spoken irrigation command through the same safety gate as typed chat', async () => {
    setSpeechToTextProviderForTests({
      transcribe: async () => ({ ok: true, text: 'Turn on the pump' }),
    })
    const spoken = await agent.post('/api/assistant/speech').set('Content-Type', 'audio/wav').send(silentWav)
    const chat = await agent.post('/api/assistant/chat').send({ message: spoken.body.text })
    expect(chat.body.action?.ok).toBe(false)
    expect(chat.body.action?.reason).toMatch(/manual mode/i)
    expect(chat.body.reply.toLowerCase()).toMatch(/safety gate|manual/)
  })

  it('typed chat still works while speech is available', async () => {
    const res = await agent.post('/api/assistant/chat').send({ message: 'Is it raining?' })
    expect(res.status).toBe(200)
    expect(res.body.reply.toLowerCase()).toMatch(/rain/)
  })

  it('does not invent words when speech is not configured', async () => {
    setSpeechToTextProviderForTests(new UnavailableSpeechToTextProvider())
    const res = await agent.post('/api/assistant/speech').set('Content-Type', 'audio/wav').send(silentWav)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(false)
    expect(res.body.text).toBeUndefined()
    expect(res.body.reason).toMatch(/type your question/i)
    expect(res.body.reason).not.toMatch(/KHAYA_API_KEY|KHAYA_ASR_API_KEY|KHAYA_TTS_API_KEY|asr|http/i)
  })

  it('reads KHAYA_API_KEY from the server environment and calls Khaya ASR v3', async () => {
    const previous = process.env.KHAYA_API_KEY
    process.env.KHAYA_API_KEY = 'env-test-key'
    setSpeechToTextProviderForTests(null)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ text: 'How much water do I have?' }),
      }),
    )
    try {
      const res = await agent
        .post('/api/assistant/speech')
        .set('Content-Type', 'audio/wav')
        .send(Buffer.alloc(256, 1))
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ ok: true, text: 'How much water do I have?' })
      const [calledUrl, init] = vi.mocked(fetch).mock.calls[0] ?? []
      expect(String(calledUrl)).toContain('translation-api.ghananlp.org/asr/v3/transcribe')
      expect(String(calledUrl)).not.toMatch(/asr\/v1/i)
      expect((init as RequestInit | undefined)?.headers).toMatchObject({
        'Ocp-Apim-Subscription-Key': 'env-test-key',
      })
    } finally {
      vi.unstubAllGlobals()
      if (previous === undefined) delete process.env.KHAYA_API_KEY
      else process.env.KHAYA_API_KEY = previous
    }
  })

  it('listens in Asante Twi when that language is requested', async () => {
    const previous = process.env.KHAYA_API_KEY
    process.env.KHAYA_API_KEY = 'env-test-key'
    setSpeechToTextProviderForTests(null)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ text: 'Nsu no yɛ.' }),
      }),
    )
    try {
      const res = await agent
        .post('/api/assistant/speech?language=twi')
        .set('Content-Type', 'audio/wav')
        .send(Buffer.alloc(256, 1))
      expect(res.body).toEqual({ ok: true, text: 'Nsu no yɛ.' })
      expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toContain('language=twi')
    } finally {
      vi.unstubAllGlobals()
      if (previous === undefined) delete process.env.KHAYA_API_KEY
      else process.env.KHAYA_API_KEY = previous
    }
  })
})
