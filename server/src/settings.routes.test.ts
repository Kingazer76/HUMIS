import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { getTankConfig, resetFarmSettingsForTests } from './config/farmSettings.js'
import { TANK_CONFIG } from './config/seedData.js'
import { simulatedProvider } from './providers/index.js'

const app = createApp()

describe('GET/PUT /api/settings', () => {
  beforeEach(() => {
    resetFarmSettingsForTests()
    simulatedProvider?.resetForTests()
  })

  afterEach(() => {
    resetFarmSettingsForTests()
    simulatedProvider?.resetForTests()
  })

  it('returns the live tank settings, zones, and crops', async () => {
    const res = await request(app).get('/api/settings')
    expect(res.status).toBe(200)
    expect(res.body.tank).toEqual(TANK_CONFIG)
    expect(res.body.tankDefaults).toEqual(TANK_CONFIG)
    expect(Array.isArray(res.body.zones)).toBe(true)
    expect(res.body.zones.length).toBe(2)
    expect(res.body.crops.map((c: { id: string }) => c.id)).toEqual(['maize', 'tomato'])
  })

  it('changing tank capacity changes tank percentage on GET /api/water', async () => {
    const before = await request(app).get('/api/water')
    const litres = before.body.mainTankL.value as number
    const beforePct = litres / before.body.tank.capacityL

    const saved = await request(app).put('/api/settings/tank').send({
      capacityL: 20000,
      lowThresholdPct: 25,
      criticalThresholdPct: 15,
    })
    expect(saved.status).toBe(200)
    expect(saved.body.ok).toBe(true)

    const after = await request(app).get('/api/water')
    expect(after.body.tank.capacityL).toBe(20000)
    expect(after.body.mainTankL.value).toBe(litres)
    expect(after.body.mainTankL.value / after.body.tank.capacityL).toBeLessThan(beforePct)
  })

  it('shrinking capacity below the current litres clamps stored water and lowers days remaining', async () => {
    const start = await request(app).post('/api/irrigation/zone-a/start').send()
    expect(start.body.ok).toBe(true)
    simulatedProvider?.tick(60)

    const before = await request(app).get('/api/planning')
    expect(before.body.sevenDayAverageConsumptionL.value).toBeGreaterThan(0)
    const beforeDays = before.body.daysRemaining.value as number

    const saved = await request(app).put('/api/settings/tank').send({
      capacityL: 5000,
      lowThresholdPct: 25,
      criticalThresholdPct: 15,
    })
    expect(saved.body.ok).toBe(true)

    const water = await request(app).get('/api/water')
    expect(water.body.tank.capacityL).toBe(5000)
    expect(water.body.mainTankL.value).toBeLessThanOrEqual(5000)

    const after = await request(app).get('/api/planning')
    expect(after.body.daysRemaining.value).toBeLessThan(beforeDays)
  })

  it('raising the low-water warning changes shortage risk to moderate', async () => {
    const before = await request(app).get('/api/planning')
    expect(before.body.tier).toBe('low')

    const saved = await request(app).put('/api/settings/tank').send({
      capacityL: 15000,
      lowThresholdPct: 90,
      criticalThresholdPct: 15,
    })
    expect(saved.body.ok).toBe(true)

    const after = await request(app).get('/api/planning')
    expect(after.body.tier).toBe('moderate')
    expect(after.body.reason).toMatch(/low-water/i)
  })

  it('raising the stop-watering level blocks irrigation when the tank is below it', async () => {
    const saved = await request(app).put('/api/settings/tank').send({
      capacityL: 15000,
      lowThresholdPct: 90,
      criticalThresholdPct: 80,
    })
    expect(saved.body.ok).toBe(true)

    const start = await request(app).post('/api/irrigation/zone-a/start').send()
    expect(start.status).toBe(200)
    expect(start.body.ok).toBe(false)
    expect(start.body.reason).toMatch(/critical threshold/i)
  })

  it('rejects invalid tank numbers and leaves the live settings unchanged', async () => {
    const rejected = await request(app).put('/api/settings/tank').send({
      capacityL: -10,
      lowThresholdPct: 25,
      criticalThresholdPct: 15,
    })
    expect(rejected.status).toBe(200)
    expect(rejected.body.ok).toBe(false)

    const stillDefault = await request(app).get('/api/water')
    expect(stillDefault.body.tank.capacityL).toBe(15000)
    expect(getTankConfig()).toEqual(TANK_CONFIG)

    const equalThresholds = await request(app).put('/api/settings/tank').send({
      capacityL: 15000,
      lowThresholdPct: 20,
      criticalThresholdPct: 20,
    })
    expect(equalThresholds.body.ok).toBe(false)
    expect(getTankConfig().lowThresholdPct).toBe(25)
    expect(getTankConfig().criticalThresholdPct).toBe(15)
  })

  it('keeps a later GET of settings and water on the saved tank numbers (runtime persistence)', async () => {
    await request(app).put('/api/settings/tank').send({
      capacityL: 12000,
      lowThresholdPct: 40,
      criticalThresholdPct: 20,
    })

    const settings = await request(app).get('/api/settings')
    expect(settings.body.tank).toEqual({
      capacityL: 12000,
      lowThresholdPct: 40,
      criticalThresholdPct: 20,
    })
    const water = await request(app).get('/api/water')
    expect(water.body.tank.capacityL).toBe(12000)
    expect(water.body.tank.lowThresholdPct).toBe(40)
    expect(water.body.tank.criticalThresholdPct).toBe(20)
  })

  it('renames a zone and changes its crop, then GET /api/zones reflects it', async () => {
    const saved = await request(app).put('/api/settings/zones/zone-a').send({
      name: 'North maize plot',
      cropId: 'tomato',
      irrigationPreference: 'standard',
    })
    expect(saved.status).toBe(200)
    expect(saved.body.ok).toBe(true)

    const zones = await request(app).get('/api/zones')
    const zoneA = zones.body.find((z: { id: string }) => z.id === 'zone-a')
    expect(zoneA.name).toBe('North maize plot')
    expect(zoneA.cropId).toBe('tomato')
    expect(zoneA.crop.name).toBe('Tomato')
  })

  it('saves soil target overrides on a zone', async () => {
    const saved = await request(app).put('/api/settings/zones/zone-a').send({
      name: 'Zone A — North Field',
      cropId: 'maize',
      irrigationPreference: 'standard',
      overrideMinPct: 22,
      overrideMaxPct: 38,
    })
    expect(saved.body.ok).toBe(true)

    const zones = await request(app).get('/api/zones')
    const zoneA = zones.body.find((z: { id: string }) => z.id === 'zone-a')
    expect(zoneA.overrideMinPct).toBe(22)
    expect(zoneA.overrideMaxPct).toBe(38)
  })

  it('rejects moisture min at or above max without changing the zone', async () => {
    const rejected = await request(app).put('/api/settings/zones/zone-a').send({
      name: 'Zone A — North Field',
      cropId: 'maize',
      irrigationPreference: 'standard',
      overrideMinPct: 70,
      overrideMaxPct: 50,
    })
    expect(rejected.body.ok).toBe(false)

    const zones = await request(app).get('/api/zones')
    const zoneA = zones.body.find((z: { id: string }) => z.id === 'zone-a')
    expect(zoneA.overrideMinPct).toBeUndefined()
    expect(zoneA.name).toBe('Zone A — North Field')
  })

  it('saves a watering style on a zone', async () => {
    const saved = await request(app).put('/api/settings/zones/zone-b').send({
      name: 'Zone B — South Field',
      cropId: 'tomato',
      irrigationPreference: 'aggressive',
    })
    expect(saved.body.ok).toBe(true)

    const zones = await request(app).get('/api/zones')
    const zoneB = zones.body.find((z: { id: string }) => z.id === 'zone-b')
    expect(zoneB.irrigationPreference).toBe('aggressive')
  })

  it('reset restores a zone to the seeded defaults', async () => {
    await request(app).put('/api/settings/zones/zone-a').send({
      name: 'Temporary name',
      cropId: 'tomato',
      irrigationPreference: 'water-saving',
      overrideMinPct: 10,
      overrideMaxPct: 20,
    })

    const reset = await request(app).post('/api/settings/zones/zone-a/reset').send()
    expect(reset.body.ok).toBe(true)

    const zones = await request(app).get('/api/zones')
    const zoneA = zones.body.find((z: { id: string }) => z.id === 'zone-a')
    expect(zoneA.name).toBe('Zone A — North Field')
    expect(zoneA.cropId).toBe('maize')
    expect(zoneA.irrigationPreference).toBe('standard')
    expect(zoneA.overrideMinPct).toBeUndefined()
  })

  it('restoring tank defaults returns the seeded 15,000 L / 25% / 15%', async () => {
    await request(app).put('/api/settings/tank').send({
      capacityL: 8000,
      lowThresholdPct: 40,
      criticalThresholdPct: 20,
    })
    const restored = await request(app).post('/api/settings/tank/defaults').send()
    expect(restored.body.ok).toBe(true)
    expect(restored.body.tank).toEqual(TANK_CONFIG)
  })
})
