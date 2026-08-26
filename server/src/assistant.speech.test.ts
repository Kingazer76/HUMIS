import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { resetFarmSettingsForTests } from './config/farmSettings.js'
import { simulatedProvider } from './providers/index.js'
import { setSpeechToTextProviderForTests } from './speech/index.js'
import type { SpeechToTextProvider } from './speech/speechToTextProvider.js'

const app = createApp()
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

    const res = await request(app).post('/api/assistant/speech').set('Content-Type', 'audio/wav').send(silentWav)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true, text: 'How much water do I have?' })
  })

  it('asks the farmer to retry when speech is unclear', async () => {
    setSpeechToTextProviderForTests({
      transcribe: async () => ({ ok: false, reason: "I didn't catch that. Tap the microphone and try again." }),
    })

    const res = await request(app).post('/api/assistant/speech').set('Content-Type', 'audio/wav').send(silentWav)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(false)
    expect(res.body.text).toBeUndefined()
    expect(res.body.reason).toMatch(/try again/i)
  })

  it('sends the recognized sentence through the existing chat path', async () => {
    setSpeechToTextProviderForTests({
      transcribe: async () => ({ ok: true, text: 'How much water do I have?' }),
    })
    const spoken = await request(app).post('/api/assistant/speech').set('Content-Type', 'audio/wav').send(silentWav)
    expect(spoken.body.ok).toBe(true)

    const chat = await request(app).post('/api/assistant/chat').send({ message: spoken.body.text })
    expect(chat.status).toBe(200)
    expect(chat.body.reply).toMatch(/L/)
    expect(chat.body.reply.toLowerCase()).toMatch(/tank|water level/)
  })

  it('sends a spoken irrigation command through the same safety gate as typed chat', async () => {
    setSpeechToTextProviderForTests({
      transcribe: async () => ({ ok: true, text: 'Turn on the pump' }),
    })
    const spoken = await request(app).post('/api/assistant/speech').set('Content-Type', 'audio/wav').send(silentWav)
    const chat = await request(app).post('/api/assistant/chat').send({ message: spoken.body.text })
    expect(chat.body.action?.ok).toBe(false)
    expect(chat.body.action?.reason).toMatch(/manual mode/i)
    expect(chat.body.reply.toLowerCase()).toMatch(/safety gate|manual/)
  })

  it('typed chat still works while speech is available', async () => {
    const res = await request(app).post('/api/assistant/chat').send({ message: 'Is it raining?' })
    expect(res.status).toBe(200)
    expect(res.body.reply.toLowerCase()).toMatch(/rain/)
  })

  it('does not invent words when speech is not configured', async () => {
    setSpeechToTextProviderForTests(null)
    const res = await request(app).post('/api/assistant/speech').set('Content-Type', 'audio/wav').send(silentWav)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(false)
    expect(res.body.text).toBeUndefined()
    expect(res.body.reason).toMatch(/AZURE_SPEECH_KEY/)
  })
})
