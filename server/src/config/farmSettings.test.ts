import { afterEach, describe, expect, it } from 'vitest'
import {
  applyFarmLocation,
  applyTankSettings,
  getFarmLocation,
  getTankConfig,
  resetFarmSettingsForTests,
  restoreDefaultTankSettings,
  validateTankSettings,
} from './farmSettings.js'
import { FARM_LOCATION, TANK_CONFIG } from './seedData.js'

describe('farmSettings', () => {
  afterEach(() => {
    resetFarmSettingsForTests()
  })

  it('starts from the seeded tank defaults', () => {
    expect(getTankConfig()).toEqual(TANK_CONFIG)
  })

  it('accepts a larger tank size', () => {
    const result = applyTankSettings({
      capacityL: 20000,
      lowThresholdPct: 25,
      criticalThresholdPct: 15,
    })
    expect(result.ok).toBe(true)
    expect(getTankConfig().capacityL).toBe(20000)
  })

  it('rejects a tank size of 0 or less without changing the live settings', () => {
    applyTankSettings({ capacityL: 8000, lowThresholdPct: 30, criticalThresholdPct: 10 })
    const rejected = applyTankSettings({
      capacityL: 0,
      lowThresholdPct: 30,
      criticalThresholdPct: 10,
    })
    expect(rejected.ok).toBe(false)
    expect(rejected.reason).toMatch(/greater than 0/i)
    expect(getTankConfig().capacityL).toBe(8000)
  })

  it('rejects a low-water warning of 100% or more', () => {
    const rejected = validateTankSettings({
      capacityL: 15000,
      lowThresholdPct: 100,
      criticalThresholdPct: 15,
    })
    expect(rejected.ok).toBe(false)
    expect(getTankConfig()).toEqual(TANK_CONFIG)
  })

  it('rejects a stop-watering level that is not below the low-water warning', () => {
    const rejected = applyTankSettings({
      capacityL: 15000,
      lowThresholdPct: 25,
      criticalThresholdPct: 25,
    })
    expect(rejected.ok).toBe(false)
    expect(getTankConfig()).toEqual(TANK_CONFIG)
  })

  it('does not mutate the seeded defaults object', () => {
    applyTankSettings({ capacityL: 1, lowThresholdPct: 50, criticalThresholdPct: 10 })
    expect(TANK_CONFIG.capacityL).toBe(15000)
  })

  it('restores the usual farm defaults', () => {
    applyTankSettings({ capacityL: 8000, lowThresholdPct: 40, criticalThresholdPct: 20 })
    const restored = restoreDefaultTankSettings()
    expect(restored.ok).toBe(true)
    expect(getTankConfig()).toEqual(TANK_CONFIG)
  })
})

describe('farm location', () => {
  afterEach(() => {
    resetFarmSettingsForTests()
  })

  it('starts from the seeded Ghana farm location', () => {
    expect(getFarmLocation()).toEqual(FARM_LOCATION)
  })

  it('saves a new place and uses those coordinates', () => {
    const result = applyFarmLocation({ latitude: 5.55, longitude: -0.2, label: 'Accra, Ghana' })
    expect(result.ok).toBe(true)
    expect(getFarmLocation()).toEqual({ latitude: 5.55, longitude: -0.2, label: 'Accra, Ghana' })
  })

  it('rejects a latitude outside -90 to 90 without changing the live location', () => {
    const rejected = applyFarmLocation({ latitude: 200, longitude: 0, label: 'Nowhere' })
    expect(rejected.ok).toBe(false)
    expect(getFarmLocation()).toEqual(FARM_LOCATION)
  })
})
