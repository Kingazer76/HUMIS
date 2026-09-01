import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAuthedAgent } from '../test/authedAgent.js'
import { createApp } from '../app.js'
import { resetPendingConfirmForTests } from './handleMessage.js'
import { resetFarmSettingsForTests } from '../config/farmSettings.js'
import { simulatedProvider } from '../providers/index.js'

const app = createApp()
const agent = await createAuthedAgent(app)

const previousKey = process.env.KHAYA_API_KEY

beforeEach(() => {
  resetFarmSettingsForTests()
  resetPendingConfirmForTests()
  simulatedProvider?.resetForTests()
  process.env.KHAYA_API_KEY = 'env-test-localize-key'
})

afterEach(() => {
  vi.unstubAllGlobals()
  resetFarmSettingsForTests()
  resetPendingConfirmForTests()
  simulatedProvider?.resetForTests()
  if (previousKey === undefined) delete process.env.KHAYA_API_KEY
  else process.env.KHAYA_API_KEY = previousKey
})

describe('localized assistant chat', () => {
  it('keeps English tank answers on the existing farm path', async () => {
    const res = await agent
      .post('/api/assistant/chat')
      .send({ message: 'How much water is in the tank?', language: 'eng' })
    expect(res.status).toBe(200)
    expect(res.body.reply.toLowerCase()).toMatch(/tank|water level/)
    expect(res.body.reply).toMatch(/L/)
  })

  it('translates a Ghanaian question, still uses parseIntent, then translates the farm answer', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string | URL, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? '{}')) as { lang?: string }
        if (body.lang === 'twi-eng') {
          return { ok: true, json: async () => 'How much water is in the tank?' }
        }
        if (body.lang === 'eng-twi') {
          return { ok: true, json: async () => 'Nsu dodow ahe na ɛwɔ tank no mu?' }
        }
        return { ok: false, json: async () => ({}) }
      }),
    )
    const res = await agent
      .post('/api/assistant/chat')
      .send({ message: 'Ɛyɛ dɛn wɔ hɔ?', language: 'twi' })
    expect(res.status).toBe(200)
    expect(res.body.reply).toBe('Nsu dodow ahe na ɛwɔ tank no mu?')
    expect(vi.mocked(fetch).mock.calls.length).toBeGreaterThan(0)
  })

  it('still runs the safety gate for a Ghanaian-language pump command', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string | URL, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? '{}')) as { lang?: string }
        if (body.lang === 'twi-eng') {
          return { ok: true, json: async () => 'Turn on the pump' }
        }
        if (body.lang === 'eng-twi') {
          return { ok: true, json: async () => 'Mepɛ sɛ me sɔ no' }
        }
        return { ok: false, json: async () => ({}) }
      }),
    )
    const res = await agent.post('/api/assistant/chat').send({ message: 'Hyɛ ase ma me', language: 'twi' })
    expect(res.status).toBe(200)
    expect(res.body.action?.ok).toBe(false)
    expect(res.body.action?.reason).toMatch(/manual mode/i)
  })

  it('does not bypass the safety gate when Twi is selected and the command is English', async () => {
    const res = await agent
      .post('/api/assistant/chat')
      .send({ message: 'Turn on the pump', language: 'twi' })
    expect(res.status).toBe(200)
    expect(res.body.action?.ok).toBe(false)
    expect(res.body.action?.reason).toMatch(/manual mode/i)
  })

  it('skips inbound translation when English already matches an intent', async () => {
    const fetchMock = vi.fn(async (_url: string | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as { lang?: string }
      if (body.lang === 'eng-twi') {
        return { ok: true, json: async () => 'Nsu dodow ahe na ɛwɔ tank no mu?' }
      }
      return { ok: false, json: async () => ({}) }
    })
    vi.stubGlobal('fetch', fetchMock)
    const res = await agent
      .post('/api/assistant/chat')
      .send({ message: 'How much water is in the tank?', language: 'twi' })
    expect(res.status).toBe(200)
    expect(res.body.reply).toBe('Nsu dodow ahe na ɛwɔ tank no mu?')
    const pairs = fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init?.body ?? '{}')).lang)
    expect(pairs).not.toContain('twi-eng')
    expect(pairs).toContain('eng-twi')
  })
})
