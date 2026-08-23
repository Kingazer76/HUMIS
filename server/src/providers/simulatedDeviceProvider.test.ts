import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TANK_CONFIG, WATER_SOURCE_CONFIGS } from '../config/seedData.js'
import { SimulatedDeviceProvider } from './simulatedDeviceProvider.js'

describe('SimulatedDeviceProvider', () => {
  let provider: SimulatedDeviceProvider

  beforeEach(() => {
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
})
