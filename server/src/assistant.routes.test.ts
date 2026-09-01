import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createAuthedAgent } from './test/authedAgent.js'
import { createApp } from './app.js'
import { resetPendingConfirmForTests } from './assistant/handleMessage.js'
import { resetFarmSettingsForTests } from './config/farmSettings.js'
import { simulatedProvider } from './providers/index.js'

const app = createApp()
const agent = await createAuthedAgent(app)

beforeEach(() => {
  resetFarmSettingsForTests()
  resetPendingConfirmForTests()
  simulatedProvider?.resetForTests()
})

afterEach(() => {
  resetFarmSettingsForTests()
  resetPendingConfirmForTests()
  simulatedProvider?.resetForTests()
})

describe('POST /api/assistant/chat', () => {
  it('rejects a missing message', async () => {
    const res = await agent.post('/api/assistant/chat').send({})
    expect(res.status).toBe(400)
  })

  it('answers a tank question from live farm data', async () => {
    const res = await agent.post('/api/assistant/chat').send({ message: 'How much water is in the tank?' })
    expect(res.status).toBe(200)
    expect(res.body.reply).toMatch(/L/)
    expect(res.body.reply.toLowerCase()).toMatch(/tank|water level/)
    expect(res.body.reply.toLowerCase()).toMatch(/simulated|measured/)
  })

  it('answers days remaining as a forecast', async () => {
    const res = await agent.post('/api/assistant/chat').send({ message: 'How many days of water are left?' })
    expect(res.status).toBe(200)
    expect(res.body.reply.toLowerCase()).toMatch(/day|watering data/)
  })

  it('blocks turning the pump on while Auto mode is on — same safety gate as Irrigation', async () => {
    const res = await agent.post('/api/assistant/chat').send({ message: 'Turn on the pump' })
    expect(res.status).toBe(200)
    expect(res.body.action?.ok).toBe(false)
    expect(res.body.reply.toLowerCase()).toMatch(/safety gate|manual/)
    expect(res.body.action?.reason).toMatch(/manual mode/i)
  })

  it('starts a named field through safetyController', async () => {
    const res = await agent
      .post('/api/assistant/chat')
      .send({ message: 'Start watering zone a' })
    expect(res.status).toBe(200)
    expect(res.body.action?.ok).toBe(true)

    const zones = await agent.get('/api/zones')
    expect(zones.body.find((z: { id: string }) => z.id === 'zone-a').state.active).toBe(true)
  })

  it('stops watering through safetyController', async () => {
    await agent.post('/api/assistant/chat').send({ message: 'Start watering zone a' })
    const res = await agent.post('/api/assistant/chat').send({ message: 'Stop watering zone a' })
    expect(res.status).toBe(200)
    expect(res.body.action?.ok).toBe(true)

    const zones = await agent.get('/api/zones')
    expect(zones.body.find((z: { id: string }) => z.id === 'zone-a').state.active).toBe(false)
  })

  it('Irrigation pump route still uses the same safety gate after assistant calls', async () => {
    const res = await agent.post('/api/irrigation/pump').send({ isOn: true })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(false)
    expect(res.body.reason).toMatch(/manual mode/i)
  })

  it('does not start watering when the tank is at the critical level', async () => {
    const saved = await agent.put('/api/settings/tank').send({
      capacityL: 15000,
      lowThresholdPct: 90,
      criticalThresholdPct: 80,
    })
    expect(saved.body.ok).toBe(true)

    const res = await agent.post('/api/assistant/chat').send({ message: 'Start watering zone a' })
    expect(res.status).toBe(200)
    expect(res.body.action?.ok).toBe(false)
    expect(res.body.reply.toLowerCase()).toMatch(/safety gate/)
    expect(res.body.action?.reason).toMatch(/critical/i)

    const zones = await agent.get('/api/zones')
    expect(zones.body.find((z: { id: string }) => z.id === 'zone-a').state.active).toBe(false)
  })

  it('does not dump farm status when speech is unclear', async () => {
    const res = await agent.post('/api/assistant/chat').send({ message: 'asdfghjk' })
    expect(res.status).toBe(200)
    expect(res.body.reply).toMatch(/didn['’]t quite catch that/i)
    expect(res.body.reply).not.toMatch(/L in the tank|Water level is good/i)
    expect(res.body.action).toBeUndefined()
  })

  it('asks before acting on a likely but uncertain pump command', async () => {
    const res = await agent.post('/api/assistant/chat').send({ message: 'Turn on the comb.' })
    expect(res.status).toBe(200)
    expect(res.body.reply).toMatch(/misheard/i)
    expect(res.body.reply).toMatch(/turn on the pump/i)
    expect(res.body.action).toBeUndefined()

    const pump = await agent.get('/api/system')
    expect(pump.body.pump.isOn.value).toBe(false)
  })

  it('only runs a confirmed guess through the same safety gate', async () => {
    await agent.post('/api/assistant/chat').send({ message: 'Turn on the comb.' })
    const res = await agent.post('/api/assistant/chat').send({ message: 'Yes' })
    expect(res.status).toBe(200)
    expect(res.body.action?.ok).toBe(false)
    expect(res.body.action?.reason).toMatch(/manual mode/i)
    expect(res.body.reply.toLowerCase()).toMatch(/safety gate|manual/)
  })

  it('cancels an uncertain command without touching the pump', async () => {
    await agent.post('/api/assistant/chat').send({ message: 'Turn on the comb.' })
    const res = await agent.post('/api/assistant/chat').send({ message: 'No' })
    expect(res.status).toBe(200)
    expect(res.body.reply).toMatch(/will not do that/i)
    expect(res.body.action).toBeUndefined()
  })

  it('after a clear yes, still uses the safety gate to turn the pump on', async () => {
    const mode = await agent.post('/api/assistant/chat').send({ message: 'Switch to manual' })
    expect(mode.body.action?.ok).toBe(true)
    await agent.post('/api/assistant/chat').send({ message: 'Turn on the comb.' })
    const res = await agent.post('/api/assistant/chat').send({ message: 'Yes' })
    expect(res.status).toBe(200)
    expect(res.body.action?.ok).toBe(true)
    const system = await agent.get('/api/system')
    expect(system.body.pump.isOn.value).toBe(true)
  })

  it('does not dump farm status when ASR text is nonsense', async () => {
    const res = await agent.post('/api/assistant/chat').send({ message: 'Shod I       Gatinao.' })
    expect(res.status).toBe(200)
    expect(res.body.reply).toMatch(/didn['’]t quite catch that/i)
    expect(res.body.reply).not.toMatch(/Water level is good/i)
    expect(res.body.action).toBeUndefined()
  })

  it('answers should-I-irrigate as a question, not a watering start', async () => {
    const res = await agent.post('/api/assistant/chat').send({ message: 'Should I irrigate now?' })
    expect(res.status).toBe(200)
    expect(res.body.action).toBeUndefined()
    expect(res.body.reply.toLowerCase()).toMatch(/watering|pump|field/)
    expect(res.body.reply).not.toMatch(/didn['’]t quite catch that/i)
  })
})
