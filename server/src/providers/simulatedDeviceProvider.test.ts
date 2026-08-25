import { beforeEach, describe, expect, it, vi } from 'vitest'
import { applyTankSettings, resetFarmSettingsForTests } from '../config/farmSettings.js'
import { IRRIGATION_ZONE_CONFIGS, TANK_CONFIG, WATER_SOURCE_CONFIGS } from '../config/seedData.js'
import { SimulatedDeviceProvider } from './simulatedDeviceProvider.js'

describe('SimulatedDeviceProvider', () => {
  let provider: SimulatedDeviceProvider

  beforeEach(() => {
    resetFarmSettingsForTests()
    provider = new SimulatedDeviceProvider()
  })

  it('keeps the tank level within [0, capacity] across many ticks', async () => {
    for (let i = 0; i < 500; i += 1) provider.tick(5)
    const tank = await provider.getTankLevel()
    expect(tank.levelL.value).toBeGreaterThanOrEqual(0)
    expect(tank.levelL.value).toBeLessThanOrEqual(TANK_CONFIG.capacityL)
  })

  it('keeps every source level within [0, its capacity] across many ticks', async () => {
    for (let i = 0; i < 500; i += 1) provider.tick(5)
    const sources = await provider.getSources()
    for (const source of sources) {
      expect(source.state.currentL.value).toBeGreaterThanOrEqual(0)
      expect(source.state.currentL.value).toBeLessThanOrEqual(source.capacityL)
    }
  })

  it('keeps soil moisture within a plausible sensor range across many ticks', async () => {
    for (let i = 0; i < 2000; i += 1) provider.tick(5)
    const zones = await provider.getZones()
    for (const zone of zones) {
      expect(zone.state.soilMoisturePct.value).toBeGreaterThanOrEqual(0)
      expect(zone.state.soilMoisturePct.value).toBeLessThanOrEqual(100)
    }
  })

  it('tags every simulated reading as simulated, never as measured', async () => {
    provider.tick(1)
    const tank = await provider.getTankLevel()
    const [source] = await provider.getSources()
    const [zone] = await provider.getZones()
    const rain = await provider.getRainStatus()
    const pump = await provider.getPumpStatus()

    expect(tank.levelL.tag).toBe('simulated')
    expect(source.state.currentL.tag).toBe('simulated')
    expect(zone.state.soilMoisturePct.tag).toBe('simulated')
    expect(rain.isRaining.tag).toBe('simulated')
    expect(pump.isOn.tag).toBe('simulated')
  })

  it('a source with a 0 configured transfer rate contributes 0 estimated water in', async () => {
    const manualSourceCfg = WATER_SOURCE_CONFIGS.find((c) => c.id === 'manual-supply')!
    expect(manualSourceCfg.nominalTransferRateLPerMin).toBe(0)

    const before = (await provider.getSources()).find((s) => s.id === 'manual-supply')!.state.currentL.value
    provider.tick(50)
    const after = (await provider.getSources()).find((s) => s.id === 'manual-supply')!.state.currentL.value

    // Manual supply never auto-transfers (0 rate) and never receives rain, so it should be unchanged.
    expect(after).toBe(before)
  })

  it('a zone that is never set active contributes 0 estimated water used', () => {
    const result = provider.tick(100)
    expect(result.waterUsedL).toBe(0)
  })

  it('reports the currently active flow input source as configured-rate', () => {
    expect(provider.getFlowInputSource()).toBe('configured-rate')
  })

  it('accumulates simulated minutes elapsed across ticks (used by shortagePrediction for a daily-rate estimate)', () => {
    expect(provider.getSimulatedMinutesElapsed()).toBe(0)
    provider.tick(5)
    provider.tick(3)
    expect(provider.getSimulatedMinutesElapsed()).toBe(8)
  })

  it('records irrigation usage into the rolling 7-day consumption window used by planning', async () => {
    expect(provider.getRollingConsumptionWindow()).toEqual({
      completedDaysUsedL: [],
      currentDayUsedL: 0,
      currentDayMinutes: 0,
    })

    await provider.setZoneValve('zone-a', true)
    provider.tick(10)
    const partial = provider.getRollingConsumptionWindow()
    expect(partial.completedDaysUsedL).toEqual([])
    expect(partial.currentDayMinutes).toBe(10)
    expect(partial.currentDayUsedL).toBeGreaterThan(0)

    provider.tick(24 * 60)
    const afterADay = provider.getRollingConsumptionWindow()
    expect(afterADay.completedDaysUsedL.length).toBe(1)
    expect(afterADay.currentDayMinutes).toBe(10)
  })

  it('tracks estimated water used per zone for history (configured rate × time active)', async () => {
    expect(provider.getCumulativeUsedByZoneL('zone-a')).toBe(0)
    await provider.setZoneValve('zone-a', true)
    provider.tick(10)
    expect(provider.getCumulativeUsedByZoneL('zone-a')).toBeGreaterThan(0)
    expect(provider.getCumulativeUsedByZoneL('zone-b')).toBe(0)
  })

  it('produces rain events over enough ticks (probabilistic, seeded via repeated trials)', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0) // forces the 8%-chance branch to fire immediately
    provider.tick(1)
    const rain = await provider.getRainStatus()
    expect(rain.isRaining.value).toBe(true)
    vi.restoreAllMocks()
  })

  it('setZoneValve actually changes a zone active state (only ever meant to be called by the future safety controller)', async () => {
    await provider.setZoneValve('zone-a', true)
    const zones = await provider.getZones()
    expect(zones.find((z) => z.id === 'zone-a')?.state.active).toBe(true)
  })

  it('returns live zone config copies, not the seeded objects', async () => {
    provider.updateZoneConfig({
      ...IRRIGATION_ZONE_CONFIGS[0]!,
      name: 'Renamed in memory',
    })
    const zones = await provider.getZones()
    expect(zones.find((z) => z.id === 'zone-a')?.name).toBe('Renamed in memory')
    expect(IRRIGATION_ZONE_CONFIGS[0]!.name).toBe('Zone A — North Field')
  })

  it('clamps stored litres when tank capacity shrinks below the current level', async () => {
    applyTankSettings({ capacityL: 5000, lowThresholdPct: 25, criticalThresholdPct: 15 })
    provider.applyTankCapacity(5000)
    const tank = await provider.getTankLevel()
    expect(tank.levelL.value).toBeLessThanOrEqual(5000)
    provider.tick(1)
    const afterTick = await provider.getTankLevel()
    expect(afterTick.levelL.value).toBeLessThanOrEqual(5000)
  })
})
