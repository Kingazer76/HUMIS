import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  CropProfile,
  IrrigationZone,
  OperationMode,
  PumpStateReading,
  RainStatusReading,
  SystemStatusReading,
  TankState,
  WaterSource,
} from '@aquaflow/shared'
import type { DeviceProvider } from '../providers/deviceProvider.js'
import { safetyController } from './safetyController.js'

const maize: CropProfile = {
  id: 'maize',
  name: 'Maize',
  defaultMinMoisturePct: 40,
  defaultMaxMoisturePct: 60,
  priority: 'medium',
}

function isoNow(): string {
  return new Date().toISOString()
}

function makeZone(zoneId: string, overrides: Partial<IrrigationZone['state']> = {}): IrrigationZone {
  return {
    id: zoneId,
    name: zoneId,
    cropId: 'maize',
    sensorMode: 'default',
    irrigationPreference: 'standard',
    nominalOutflowRateLPerMin: 5,
    crop: maize,
    state: {
      id: zoneId,
      soilMoisturePct: { value: 30, tag: 'simulated', asOf: isoNow() },
      active: false,
      lastWateredAt: null,
      ...overrides,
    },
  }
}

/**
 * A fully controllable fake `DeviceProvider`, used so every safety
 * interlock (critical tank, stale reading, invalid reading) can be tested
 * deterministically without depending on `SimulatedDeviceProvider`'s own
 * timing/randomness. `setZoneValve`/`setPumpState` calls are recorded so
 * tests can assert `safetyController` really is the sole caller.
 *
 * Each test uses its own unique zone id (see `makeZone` calls below) so
 * `safetyController`'s module-level debounce map — which intentionally
 * persists for the lifetime of the process, exactly like it would in the
 * real server — can't leak state between otherwise-unrelated tests.
 */
class FakeDeviceProvider implements DeviceProvider {
  tankLevelL = 9000
  tankAsOf = isoNow()
  zones: IrrigationZone[]
  pumpOn = false
  operationMode: OperationMode = 'auto'

  setZoneValveCalls: Array<{ zoneId: string; isOn: boolean }> = []
  setPumpStateCalls: boolean[] = []

  constructor(zones: IrrigationZone[]) {
    this.zones = zones
  }

  async getTankLevel(): Promise<TankState> {
    return { levelL: { value: this.tankLevelL, tag: 'simulated', asOf: this.tankAsOf } }
  }
  async getSources(): Promise<WaterSource[]> {
    return []
  }
  async getZones(): Promise<IrrigationZone[]> {
    return this.zones
  }
  async getZoneConfig() {
    return undefined
  }
  async getRainStatus(): Promise<RainStatusReading> {
    return { isRaining: { value: false, tag: 'simulated', asOf: isoNow() } }
  }
  async getPumpStatus(): Promise<PumpStateReading> {
    return { isOn: { value: this.pumpOn, tag: 'simulated', asOf: isoNow() } }
  }
  async getOperationMode(): Promise<OperationMode> {
    return this.operationMode
  }
  async getSystemStatus(): Promise<SystemStatusReading> {
    return { phase: 'waiting', operationMode: this.operationMode }
  }
  async setPumpState(isOn: boolean): Promise<void> {
    this.setPumpStateCalls.push(isOn)
    this.pumpOn = isOn
  }
  async setZoneValve(zoneId: string, isOn: boolean): Promise<void> {
    this.setZoneValveCalls.push({ zoneId, isOn })
    const zone = this.zones.find((z) => z.id === zoneId)
    if (zone) zone.state.active = isOn
  }
  async setOperationMode(mode: OperationMode): Promise<void> {
    this.operationMode = mode
  }
}

let fakeProvider: FakeDeviceProvider

vi.mock('../providers/index.js', () => ({
  get deviceProvider() {
    return fakeProvider
  },
  simulatedProvider: null,
}))

describe('safetyController', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts a zone when the tank is healthy and the zone is currently off', async () => {
    fakeProvider = new FakeDeviceProvider([makeZone('zone-start-healthy')])
    const result = await safetyController.setZoneActive('zone-start-healthy', true, 'manual')
    expect(result.ok).toBe(true)
    expect(fakeProvider.setZoneValveCalls).toEqual([{ zoneId: 'zone-start-healthy', isOn: true }])
  })

  it('rejects starting a zone when the tank is at or below the critical threshold', async () => {
    fakeProvider = new FakeDeviceProvider([makeZone('zone-critical-tank')])
    fakeProvider.tankLevelL = 2000 // 2000/15000 = 13.3%, below the 15% critical threshold
    const result = await safetyController.setZoneActive('zone-critical-tank', true, 'manual')
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/critical threshold/i)
    expect(fakeProvider.setZoneValveCalls).toEqual([])
  })

  it('still allows stopping a zone even when the tank is at or below the critical threshold', async () => {
    fakeProvider = new FakeDeviceProvider([makeZone('zone-stop-critical', { active: true })])
    fakeProvider.tankLevelL = 1000
    const result = await safetyController.setZoneActive('zone-stop-critical', false, 'manual')
    expect(result.ok).toBe(true)
    expect(fakeProvider.setZoneValveCalls).toEqual([{ zoneId: 'zone-stop-critical', isOn: false }])
  })

  it('rejects an action when the zone moisture reading is stale', async () => {
    const staleTimestamp = new Date(Date.now() - 60_000).toISOString() // 60s old, older than the 30s max
    fakeProvider = new FakeDeviceProvider([
      makeZone('zone-stale-moisture', { soilMoisturePct: { value: 30, tag: 'simulated', asOf: staleTimestamp } }),
    ])
    const result = await safetyController.setZoneActive('zone-stale-moisture', true, 'manual')
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/stale/i)
    expect(fakeProvider.setZoneValveCalls).toEqual([])
  })

  it('rejects an action when the tank level reading is stale', async () => {
    fakeProvider = new FakeDeviceProvider([makeZone('zone-stale-tank')])
    fakeProvider.tankAsOf = new Date(Date.now() - 60_000).toISOString()
    const result = await safetyController.setZoneActive('zone-stale-tank', true, 'manual')
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/stale/i)
    expect(fakeProvider.setZoneValveCalls).toEqual([])
  })

  it('rejects an action when the zone moisture reading is out of the physically valid 0-100 range', async () => {
    fakeProvider = new FakeDeviceProvider([
      makeZone('zone-invalid-moisture', { soilMoisturePct: { value: -5, tag: 'simulated', asOf: isoNow() } }),
    ])
    const result = await safetyController.setZoneActive('zone-invalid-moisture', true, 'manual')
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/invalid/i)
    expect(fakeProvider.setZoneValveCalls).toEqual([])
  })

  it('rejects starting a zone again too soon after it was last changed (debounce)', async () => {
    fakeProvider = new FakeDeviceProvider([makeZone('zone-debounce-reject')])
    await safetyController.setZoneActive('zone-debounce-reject', true, 'manual')
    await safetyController.setZoneActive('zone-debounce-reject', false, 'manual')
    fakeProvider.setZoneValveCalls = []

    const result = await safetyController.setZoneActive('zone-debounce-reject', true, 'manual')
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/too recently/i)
    expect(fakeProvider.setZoneValveCalls).toEqual([])
  })

  it('allows starting a zone again once enough time has passed since its last change', async () => {
    fakeProvider = new FakeDeviceProvider([makeZone('zone-debounce-allow')])
    await safetyController.setZoneActive('zone-debounce-allow', true, 'manual')
    await safetyController.setZoneActive('zone-debounce-allow', false, 'manual')
    fakeProvider.setZoneValveCalls = []

    vi.advanceTimersByTime(16_000) // just past the 15s debounce window
    const result = await safetyController.setZoneActive('zone-debounce-allow', true, 'manual')
    expect(result.ok).toBe(true)
    expect(fakeProvider.setZoneValveCalls).toEqual([{ zoneId: 'zone-debounce-allow', isOn: true }])
  })

  it('is a no-op (still ok) when asked to set a zone to the state it is already in', async () => {
    fakeProvider = new FakeDeviceProvider([makeZone('zone-noop')])
    const result = await safetyController.setZoneActive('zone-noop', false, 'manual')
    expect(result.ok).toBe(true)
    expect(fakeProvider.setZoneValveCalls).toEqual([])
  })

  it('rejects actions for an unknown zone', async () => {
    fakeProvider = new FakeDeviceProvider([makeZone('zone-unrelated')])
    const result = await safetyController.setZoneActive('does-not-exist', true, 'manual')
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/unknown zone/i)
  })

  it('syncs the pump on when a zone starts in Auto mode', async () => {
    fakeProvider = new FakeDeviceProvider([makeZone('zone-pump-sync-auto')])
    await safetyController.setZoneActive('zone-pump-sync-auto', true, 'manual')
    expect(fakeProvider.setPumpStateCalls).toEqual([true])
  })

  it('does not touch the pump when a zone starts in Manual mode', async () => {
    fakeProvider = new FakeDeviceProvider([makeZone('zone-pump-sync-manual')])
    fakeProvider.operationMode = 'manual'
    await safetyController.setZoneActive('zone-pump-sync-manual', true, 'manual')
    expect(fakeProvider.setPumpStateCalls).toEqual([])
  })

  it('rejects direct pump control while in Auto mode', async () => {
    fakeProvider = new FakeDeviceProvider([makeZone('zone-pump-auto-guard')])
    const result = await safetyController.setPumpState(true)
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/manual mode/i)
    expect(fakeProvider.setPumpStateCalls).toEqual([])
  })

  it('allows direct pump control in Manual mode when the tank is healthy', async () => {
    fakeProvider = new FakeDeviceProvider([makeZone('zone-pump-manual-ok')])
    fakeProvider.operationMode = 'manual'
    const result = await safetyController.setPumpState(true)
    expect(result.ok).toBe(true)
    expect(fakeProvider.setPumpStateCalls).toEqual([true])
  })

  it('rejects manually turning the pump on when the tank is at or below the critical threshold', async () => {
    fakeProvider = new FakeDeviceProvider([makeZone('zone-pump-manual-critical')])
    fakeProvider.operationMode = 'manual'
    fakeProvider.tankLevelL = 1000
    const result = await safetyController.setPumpState(true)
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/critical threshold/i)
    expect(fakeProvider.setPumpStateCalls).toEqual([])
  })

  it('always allows manually turning the pump off, even when the tank is critical', async () => {
    fakeProvider = new FakeDeviceProvider([makeZone('zone-pump-manual-off-critical')])
    fakeProvider.operationMode = 'manual'
    fakeProvider.tankLevelL = 1000
    const result = await safetyController.setPumpState(false)
    expect(result.ok).toBe(true)
    expect(fakeProvider.setPumpStateCalls).toEqual([false])
  })

  it('switches operation mode', async () => {
    fakeProvider = new FakeDeviceProvider([makeZone('zone-mode-switch')])
    const result = await safetyController.setOperationMode('manual')
    expect(result.ok).toBe(true)
    expect(fakeProvider.operationMode).toBe('manual')
  })
})
