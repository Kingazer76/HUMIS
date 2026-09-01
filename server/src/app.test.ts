import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createAuthedAgent } from './test/authedAgent.js'
import { createApp } from './app.js'
import { simulatedProvider } from './providers/index.js'

const app = createApp()
const agent = await createAuthedAgent(app)

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
    const res = await agent.get('/api/water')
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
    const res = await agent.get('/api/sources')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.length).toBeGreaterThan(0)
    for (const source of res.body) {
      expect(source.state.currentL.tag).toBe('simulated')
      if (source.kind === 'rainwater') {
        expect(source.hasOwnStorage).toBe(false)
        expect(source.state.currentL.value).toBe(0)
      } else {
        expect(source.hasOwnStorage).toBe(true)
      }
    }
  })
})

describe('GET /api/zones', () => {
  it('returns an array of tagged irrigation zones with crop info', async () => {
    const res = await agent.get('/api/zones')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    for (const zone of res.body) {
      expect(zone.state.soilMoisturePct.tag).toBe('simulated')
      expect(zone.crop).toBeTruthy()
    }
  })
})

describe('GET /api/history', () => {
  it('returns an empty list when nothing has been recorded yet', async () => {
    const { historyLog } = await import('./history/historyLog.js')
    historyLog.resetForTests()
    const res = await agent.get('/api/history')
    expect(res.status).toBe(200)
    expect(res.body.records).toEqual([])
  })

  it('returns recorded irrigation events labelled simulated, newest first', async () => {
    const { historyLog } = await import('./history/historyLog.js')
    historyLog.resetForTests()

    const start = await agent.post('/api/irrigation/zone-b/start').send()
    expect(start.status).toBe(200)
    expect(start.body.ok).toBe(true)

    const res = await agent.get('/api/history')
    expect(res.status).toBe(200)
    expect(res.body.records.length).toBeGreaterThan(0)
    const latest = res.body.records[0]
    expect(latest.tag).toBe('simulated')
    expect(latest.zoneName).toMatch(/zone b/i)
    expect(latest.cropName).toBe('Tomato')
    expect(latest.wateringAction).toBe('started')
    expect(latest.waterUsedL).toBe(0)
  })
})

describe('GET /api/planning', () => {
  it('returns a valid, safely-tagged shortage prediction end-to-end against the real seeded farm', async () => {
    const res = await agent.get('/api/planning')
    expect(res.status).toBe(200)
    expect(res.body.daysRemaining.tag).toBe('forecast')
    expect(typeof res.body.daysRemaining.value).toBe('number')
    expect(res.body.daysRemaining.value).toBeGreaterThanOrEqual(0)
    expect(['low', 'moderate', 'high', 'critical']).toContain(res.body.tier)
    expect(res.body.adjustedDailyConsumptionL.tag).toBe('estimated')
    expect(res.body.sevenDayAverageConsumptionL.tag).toBe('estimated')
    expect(typeof res.body.weatherApplied).toBe('boolean')
    expect(res.body.weather).toBeDefined()
    expect(typeof res.body.weather.available).toBe('boolean')
    if (res.body.weather.available) {
      expect(res.body.weather.source).toBe('open-meteo')
      expect(res.body.weather.temperatureC.tag).toBe('forecast')
      expect(res.body.weather.location.latitude).toBeTypeOf('number')
      expect(Array.isArray(res.body.weather.days)).toBe(true)
    }
    expect(typeof res.body.observedDays).toBe('number')
    expect(res.body.observedDays).toBeGreaterThanOrEqual(0)
  })
})

describe('GET /api/system', () => {
  it('returns tagged rain, pump, and system status', async () => {
    const res = await agent.get('/api/system')
    expect(res.status).toBe(200)
    expect(res.body.rain.isRaining.tag).toBe('simulated')
    expect(res.body.pump.isOn.tag).toBe('simulated')
    expect(['irrigating', 'waiting', 'rain-detected', 'low-water', 'soil-moisture-sufficient']).toContain(
      res.body.system.phase,
    )
  })
})

// These run in declaration order against the same live app/provider instance
// (module-scoped, like the real server) to smoke-test the full manual
// action path: route -> safetyController -> SimulatedDeviceProvider.
describe('POST /api/irrigation (manual actions, end-to-end against the real seeded farm)', () => {
  it('starts a real seeded zone through the safety controller', async () => {
    const res = await agent.post('/api/irrigation/zone-a/start').send()
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.zone.state.active).toBe(true)
  })

  it('reflects the started zone on the next zones read', async () => {
    const res = await agent.get('/api/zones')
    expect(res.body.find((z: { id: string }) => z.id === 'zone-a').state.active).toBe(true)
  })

  it('stops the same zone (stop is never debounced)', async () => {
    const res = await agent.post('/api/irrigation/zone-a/stop').send()
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.zone.state.active).toBe(false)
  })

  it('rejects an unknown zone', async () => {
    const res = await agent.post('/api/irrigation/not-a-real-zone/start').send()
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(false)
    expect(res.body.reason).toMatch(/unknown zone/i)
  })

  it('rejects direct pump control while still in Auto mode', async () => {
    const res = await agent.post('/api/irrigation/pump').send({ isOn: true })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(false)
    expect(res.body.reason).toMatch(/manual mode/i)
  })

  it('rejects a malformed pump request body', async () => {
    const res = await agent.post('/api/irrigation/pump').send({ isOn: 'yes' })
    expect(res.status).toBe(400)
  })

  it('rejects a malformed mode request body', async () => {
    const res = await agent.post('/api/irrigation/mode').send({ mode: 'turbo' })
    expect(res.status).toBe(400)
  })

  it('switches to Manual mode', async () => {
    const res = await agent.post('/api/irrigation/mode').send({ mode: 'manual' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('now allows direct pump control in Manual mode', async () => {
    const res = await agent.post('/api/irrigation/pump').send({ isOn: true })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('turns the pump back off', async () => {
    const res = await agent.post('/api/irrigation/pump').send({ isOn: false })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('switches back to Auto mode', async () => {
    const res = await agent.post('/api/irrigation/mode').send({ mode: 'auto' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})
