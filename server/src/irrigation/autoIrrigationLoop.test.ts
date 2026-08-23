import { beforeEach, describe, expect, it, vi } from 'vitest'
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

function makeZone(zoneId: string, moisturePct: number, active: boolean): IrrigationZone {
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
      soilMoisturePct: { value: moisturePct, tag: 'simulated', asOf: isoNow() },
      active,
      lastWateredAt: null,
    },
  }
}

class FakeDeviceProvider implements DeviceProvider {
  tankLevelL = 9000 // healthy, well above critical
  zones: IrrigationZone[]
  pumpOn = false
  operationMode: OperationMode = 'auto'
  setZoneValveCalls: Array<{ zoneId: string; isOn: boolean }> = []

  constructor(zones: IrrigationZone[]) {
    this.zones = zones
  }

  async getTankLevel(): Promise<TankState> {
    return { levelL: { value: this.tankLevelL, tag: 'simulated', asOf: isoNow() } }
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
}))

describe('runAutoIrrigationCycle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('starts a dry zone automatically while in Auto mode', async () => {
    fakeProvider = new FakeDeviceProvider([makeZone('cycle-dry', 30, false)])
    const { runAutoIrrigationCycle } = await import('./autoIrrigationLoop.js')
    await runAutoIrrigationCycle()
    expect(fakeProvider.setZoneValveCalls).toEqual([{ zoneId: 'cycle-dry', isOn: true }])
  })

  it('does nothing while in Manual mode', async () => {
    fakeProvider = new FakeDeviceProvider([makeZone('cycle-manual', 20, false)])
    fakeProvider.operationMode = 'manual'
    const { runAutoIrrigationCycle } = await import('./autoIrrigationLoop.js')
    await runAutoIrrigationCycle()
    expect(fakeProvider.setZoneValveCalls).toEqual([])
  })

  it('leaves a zone within its target range untouched', async () => {
    fakeProvider = new FakeDeviceProvider([makeZone('cycle-fine', 50, false)])
    const { runAutoIrrigationCycle } = await import('./autoIrrigationLoop.js')
    await runAutoIrrigationCycle()
    expect(fakeProvider.setZoneValveCalls).toEqual([])
  })

  it('stops an active zone once it reaches its target maximum', async () => {
    fakeProvider = new FakeDeviceProvider([makeZone('cycle-full', 65, true)])
    const { runAutoIrrigationCycle } = await import('./autoIrrigationLoop.js')
    await runAutoIrrigationCycle()
    expect(fakeProvider.setZoneValveCalls).toEqual([{ zoneId: 'cycle-full', isOn: false }])
  })

  it('withholds starting a dry zone when the tank is at or below the critical threshold', async () => {
    fakeProvider = new FakeDeviceProvider([makeZone('cycle-critical', 20, false)])
    fakeProvider.tankLevelL = 1000 // well below critical (15% of 15,000L = 2,250L)
    const { runAutoIrrigationCycle } = await import('./autoIrrigationLoop.js')
    await runAutoIrrigationCycle()
    expect(fakeProvider.setZoneValveCalls).toEqual([])
  })
})
