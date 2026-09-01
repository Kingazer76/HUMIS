import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAuthedAgent } from './test/authedAgent.js'
import { createApp } from './app.js'
import { resetFarmSettingsForTests } from './config/farmSettings.js'
import { simulatedProvider } from './providers/index.js'
import { setTextToSpeechProviderForTests } from './speech/index.js'
import type { TextToSpeechProvider } from './speech/textToSpeechProvider.js'
import { UnavailableTextToSpeechProvider } from './speech/unavailableTextToSpeech.js'

const app = createApp()
const agent = await createAuthedAgent(app)
const wav = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(36, 1)])

beforeEach(() => {
  resetFarmSettingsForTests()
  simulatedProvider?.resetForTests()
})

afterEach(() => {
  setTextToSpeechProviderForTests(null)
  resetFarmSettingsForTests()
  simulatedProvider?.resetForTests()
})

describe('POST /api/assistant/speak', () => {
  it('returns audio for the exact assistant reply and does not rewrite it', async () => {
    let received = ''
    const fake: TextToSpeechProvider = {
      speak: async (text) => {
        received = text
        return { ok: true, audio: wav, contentType: 'audio/wav' }
      },
    }
    setTextToSpeechProviderForTests(fake)

    const chat = await agent.post('/api/assistant/chat').send({ message: 'How much water do I have?' })
    expect(chat.status).toBe(200)
    expect(chat.body.reply).toBeTruthy()

    const spoken = await agent.post('/api/assistant/speak').send({ text: chat.body.reply })
    expect(spoken.status).toBe(200)
    expect(spoken.headers['content-type']).toMatch(/audio\/wav/)
    expect(Buffer.from(spoken.body).equals(wav)).toBe(true)
    expect(received).toBe(chat.body.reply)
  })

  it('keeps chat working when TTS fails', async () => {
    setTextToSpeechProviderForTests({
      speak: async () => ({ ok: false, reason: "Couldn't speak that. The written answer is still on screen." }),
    })
    const chat = await agent.post('/api/assistant/chat').send({ message: 'How much water do I have?' })
    const spoken = await agent.post('/api/assistant/speak').send({ text: chat.body.reply })
    expect(chat.body.reply).toMatch(/tank|water level/i)
    expect(spoken.body.ok).toBe(false)
    expect(spoken.body.reason).toMatch(/written answer is still on screen/i)
  })

  it('does not change irrigation state — speak never touches the safety gate', async () => {
    setTextToSpeechProviderForTests({
      speak: async () => ({ ok: true, audio: wav, contentType: 'audio/wav' }),
    })
    const before = await agent.get('/api/system')
    await agent.post('/api/assistant/speak').send({ text: 'Turn on the pump' })
    const after = await agent.get('/api/system')
    expect(after.body.pump.isOn.value).toBe(before.body.pump.isOn.value)

    const blocked = await agent.post('/api/assistant/chat').send({ message: 'Turn on the pump' })
    expect(blocked.body.action?.ok).toBe(false)
    expect(blocked.body.action?.reason).toMatch(/manual mode/i)
  })

  it('typed chat still works while speaking is available', async () => {
    const res = await agent.post('/api/assistant/chat').send({ message: 'Is it raining?' })
    expect(res.status).toBe(200)
    expect(res.body.reply.toLowerCase()).toMatch(/rain/)
  })

  it('does not invent audio when speech is not configured', async () => {
    setTextToSpeechProviderForTests(new UnavailableTextToSpeechProvider())
    const res = await agent.post('/api/assistant/speak').send({ text: 'Water level is good.' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(false)
    expect(res.body.reason).toMatch(/written answer is still on screen/i)
    expect(res.body.reason).not.toMatch(/KHAYA_API_KEY|KHAYA_ASR_API_KEY|KHAYA_TTS_API_KEY|tts|http/i)
  })

  it('reads KHAYA_API_KEY from the server environment and calls Khaya TTS v2', async () => {
    const previous = process.env.KHAYA_API_KEY
    process.env.KHAYA_API_KEY = 'env-test-key'
    setTextToSpeechProviderForTests(null)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'audio/wav' },
        arrayBuffer: async () => wav.buffer.slice(wav.byteOffset, wav.byteOffset + wav.byteLength),
      }),
    )
    try {
      const spoken = await agent.post('/api/assistant/speak').send({ text: 'Water level is good.' })
      expect(spoken.status).toBe(200)
      expect(spoken.headers['content-type']).toMatch(/audio\/wav/)
      const [calledUrl, init] = vi.mocked(fetch).mock.calls[0] ?? []
      expect(String(calledUrl)).toContain('translation-api.ghananlp.org/tts/v2/synthesize')
      expect(String(calledUrl)).not.toMatch(/tts\/v1/i)
      expect((init as RequestInit | undefined)?.headers).toMatchObject({
        'Ocp-Apim-Subscription-Key': 'env-test-key',
      })
    } finally {
      vi.unstubAllGlobals()
      if (previous === undefined) delete process.env.KHAYA_API_KEY
      else process.env.KHAYA_API_KEY = previous
    }
  })

  it('asks Khaya TTS to speak Asante Twi when that language is requested', async () => {
    const previous = process.env.KHAYA_API_KEY
    process.env.KHAYA_API_KEY = 'env-test-key'
    setTextToSpeechProviderForTests(null)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'audio/wav' },
        arrayBuffer: async () => wav.buffer.slice(wav.byteOffset, wav.byteOffset + wav.byteLength),
      }),
    )
    try {
      const spoken = await agent
        .post('/api/assistant/speak')
        .send({ text: 'Nsu no yɛ.', language: 'twi' })
      expect(spoken.status).toBe(200)
      expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body))).toMatchObject({
        language: 'twi',
        text: 'Nsu no yɛ.',
      })
    } finally {
      vi.unstubAllGlobals()
      if (previous === undefined) delete process.env.KHAYA_API_KEY
      else process.env.KHAYA_API_KEY = previous
    }
  })

  it('keeps the written answer when Ghanaian TTS fails', async () => {
    setTextToSpeechProviderForTests({
      speak: async () => ({ ok: false, reason: 'TTS endpoint unavailable' }),
    })
    const spoken = await agent
      .post('/api/assistant/speak')
      .send({ text: 'Nsu no yɛ.', language: 'twi' })
    expect(spoken.body.ok).toBe(false)
    expect(spoken.body.reason).toMatch(/not available for this language|written answer/i)
    expect(spoken.body.reason).not.toMatch(/KHAYA_API_KEY|tts endpoint|http/i)
  })
})
