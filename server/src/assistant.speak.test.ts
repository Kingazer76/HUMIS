import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { resetFarmSettingsForTests } from './config/farmSettings.js'
import { simulatedProvider } from './providers/index.js'
import { setTextToSpeechProviderForTests } from './speech/index.js'
import type { TextToSpeechProvider } from './speech/textToSpeechProvider.js'

const app = createApp()
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

    const chat = await request(app).post('/api/assistant/chat').send({ message: 'How much water do I have?' })
    expect(chat.status).toBe(200)
    expect(chat.body.reply).toBeTruthy()

    const spoken = await request(app).post('/api/assistant/speak').send({ text: chat.body.reply })
    expect(spoken.status).toBe(200)
    expect(spoken.headers['content-type']).toMatch(/audio\/wav/)
    expect(Buffer.from(spoken.body).equals(wav)).toBe(true)
    expect(received).toBe(chat.body.reply)
  })

  it('keeps chat working when TTS fails', async () => {
    setTextToSpeechProviderForTests({
      speak: async () => ({ ok: false, reason: "Couldn't speak that. The written answer is still on screen." }),
    })
    const chat = await request(app).post('/api/assistant/chat').send({ message: 'How much water do I have?' })
    const spoken = await request(app).post('/api/assistant/speak').send({ text: chat.body.reply })
    expect(chat.body.reply).toMatch(/tank|water level/i)
    expect(spoken.body.ok).toBe(false)
    expect(spoken.body.reason).toMatch(/written answer is still on screen/i)
  })

  it('does not change irrigation state — speak never touches the safety gate', async () => {
    setTextToSpeechProviderForTests({
      speak: async () => ({ ok: true, audio: wav, contentType: 'audio/wav' }),
    })
    const before = await request(app).get('/api/system')
    await request(app).post('/api/assistant/speak').send({ text: 'Turn on the pump' })
    const after = await request(app).get('/api/system')
    expect(after.body.pump.isOn.value).toBe(before.body.pump.isOn.value)

    const blocked = await request(app).post('/api/assistant/chat').send({ message: 'Turn on the pump' })
    expect(blocked.body.action?.ok).toBe(false)
    expect(blocked.body.action?.reason).toMatch(/manual mode/i)
  })

  it('typed chat still works while speaking is available', async () => {
    const res = await request(app).post('/api/assistant/chat').send({ message: 'Is it raining?' })
    expect(res.status).toBe(200)
    expect(res.body.reply.toLowerCase()).toMatch(/rain/)
  })

  it('does not invent audio when speech is not configured', async () => {
    setTextToSpeechProviderForTests(null)
    const res = await request(app).post('/api/assistant/speak').send({ text: 'Water level is good.' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(false)
    expect(res.body.reason).toMatch(/KHAYA_API_KEY/)
  })
})
