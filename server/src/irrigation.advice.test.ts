import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { resetFarmSettingsForTests } from './config/farmSettings.js'
import { simulatedProvider } from './providers/index.js'

const app = createApp()

describe('GET /api/irrigation/advice', () => {
  beforeEach(() => {
    resetFarmSettingsForTests()
    simulatedProvider?.resetForTests()
  })

  afterEach(() => {
    resetFarmSettingsForTests()
    simulatedProvider?.resetForTests()
  })

  it('returns per-zone advice from the existing irrigation engine', async () => {
    const res = await request(app).get('/api/irrigation/advice')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.zones)).toBe(true)
    expect(res.body.zones.length).toBe(2)
    for (const zone of res.body.zones as Array<Record<string, unknown>>) {
      expect(zone.zoneId).toBeTruthy()
      expect(zone.cropName).toBeTruthy()
      expect(zone.soilName).toBeTruthy()
      expect(zone.growthStageName).toBeTruthy()
      expect(zone.reason).toEqual(expect.any(String))
      expect(typeof zone.reason).toBe('string')
      expect((zone.reason as string).length).toBeGreaterThan(20)
      expect([
        'no-irrigation-needed',
        'monitor',
        'irrigation-recommended',
        'irrigation-urgent',
        'irrigation-limited-by-water',
      ]).toContain(zone.status)
      expect(zone.flowInputSource).toBe('configured-rate')
      expect(typeof zone.estimatedNeedL).toBe('number')
      expect(typeof zone.availableTankL).toBe('number')
    }
  })
})
