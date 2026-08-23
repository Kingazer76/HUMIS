import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { simulatedProvider } from './providers/index.js'

const app = createApp()

// Advance the simulation once so Water In / Used aren't trivially zero when checked below.
simulatedProvider?.tick(5)

describe('GET /api/health', () => {
  it('responds with ok status', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
  })
})

describe('GET /api/water', () => {
  it('returns a tagged water snapshot with the expected shape', async () => {
    const res = await request(app).get('/api/water')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      mainTankL: { tag: expect.stringMatching(/measured|simulated/) },
      transferableSourceL: { tag: 'simulated' },
      totalAvailableL: { tag: 'simulated' },
      waterInLPerMin: { tag: 'estimated', flowInputSource: 'configured-rate' },
      waterUsedLPerMin: { tag: 'estimated', flowInputSource: 'configured-rate' },
    })
    expect(typeof res.body.mainTankL.value).toBe('number')
  })
})

describe('GET /api/sources', () => {
  it('returns an array of tagged water sources', async () => {
    const res = await request(app).get('/api/sources')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.length).toBeGreaterThan(0)
    for (const source of res.body) {
      expect(source.state.currentL.tag).toBe('simulated')
    }
  })
})

describe('GET /api/zones', () => {
  it('returns an array of tagged irrigation zones with crop info', async () => {
    const res = await request(app).get('/api/zones')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    for (const zone of res.body) {
      expect(zone.state.soilMoisturePct.tag).toBe('simulated')
      expect(zone.crop).toBeTruthy()
    }
  })
})

describe('GET /api/system', () => {
  it('returns tagged rain, pump, and system status', async () => {
    const res = await request(app).get('/api/system')
    expect(res.status).toBe(200)
    expect(res.body.rain.isRaining.tag).toBe('simulated')
    expect(res.body.pump.isOn.tag).toBe('simulated')
    expect(['irrigating', 'waiting', 'rain-detected', 'low-water', 'soil-moisture-sufficient']).toContain(
      res.body.system.phase,
    )
  })
})
