import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { resetFarmSettingsForTests } from './config/farmSettings.js'
import { simulatedProvider } from './providers/index.js'

const app = createApp()

beforeEach(() => {
  resetFarmSettingsForTests()
  simulatedProvider?.resetForTests()
})

afterEach(() => {
  resetFarmSettingsForTests()
  simulatedProvider?.resetForTests()
})

describe('POST /api/assistant/chat', () => {
  it('rejects a missing message', async () => {
    const res = await request(app).post('/api/assistant/chat').send({})
    expect(res.status).toBe(400)
  })

  it('answers a tank question from live farm data', async () => {
    const res = await request(app).post('/api/assistant/chat').send({ message: 'How much water is in the tank?' })
    expect(res.status).toBe(200)
    expect(res.body.reply).toMatch(/L/)
    expect(res.body.reply.toLowerCase()).toMatch(/tank|water level/)
    expect(res.body.reply.toLowerCase()).toMatch(/simulated|measured/)
  })

  it('answers days remaining as a forecast', async () => {
    const res = await request(app).post('/api/assistant/chat').send({ message: 'How many days of water are left?' })
    expect(res.status).toBe(200)
    expect(res.body.reply.toLowerCase()).toMatch(/day|watering data/)
  })

  it('blocks turning the pump on while Auto mode is on — same safety gate as Irrigation', async () => {
    const res = await request(app).post('/api/assistant/chat').send({ message: 'Turn on the pump' })
    expect(res.status).toBe(200)
    expect(res.body.action?.ok).toBe(false)
    expect(res.body.reply.toLowerCase()).toMatch(/safety gate|manual/)
    expect(res.body.action?.reason).toMatch(/manual mode/i)
  })

  it('starts a named field through safetyController', async () => {
    const res = await request(app)
      .post('/api/assistant/chat')
      .send({ message: 'Start watering zone a' })
    expect(res.status).toBe(200)
    expect(res.body.action?.ok).toBe(true)

    const zones = await request(app).get('/api/zones')
    expect(zones.body.find((z: { id: string }) => z.id === 'zone-a').state.active).toBe(true)
  })

  it('stops watering through safetyController', async () => {
    await request(app).post('/api/assistant/chat').send({ message: 'Start watering zone a' })
    const res = await request(app).post('/api/assistant/chat').send({ message: 'Stop watering zone a' })
    expect(res.status).toBe(200)
    expect(res.body.action?.ok).toBe(true)

    const zones = await request(app).get('/api/zones')
    expect(zones.body.find((z: { id: string }) => z.id === 'zone-a').state.active).toBe(false)
  })

  it('Irrigation pump route still uses the same safety gate after assistant calls', async () => {
    const res = await request(app).post('/api/irrigation/pump').send({ isOn: true })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(false)
    expect(res.body.reason).toMatch(/manual mode/i)
  })

  it('does not start watering when the tank is at the critical level', async () => {
    const saved = await request(app).put('/api/settings/tank').send({
      capacityL: 15000,
      lowThresholdPct: 90,
      criticalThresholdPct: 80,
    })
    expect(saved.body.ok).toBe(true)

    const res = await request(app).post('/api/assistant/chat').send({ message: 'Start watering zone a' })
    expect(res.status).toBe(200)
    expect(res.body.action?.ok).toBe(false)
    expect(res.body.reply.toLowerCase()).toMatch(/safety gate/)
    expect(res.body.action?.reason).toMatch(/critical/i)

    const zones = await request(app).get('/api/zones')
    expect(zones.body.find((z: { id: string }) => z.id === 'zone-a').state.active).toBe(false)
  })
})
