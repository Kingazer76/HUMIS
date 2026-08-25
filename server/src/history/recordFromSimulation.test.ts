import { describe, expect, it } from 'vitest'
import { SimulatedDeviceProvider } from '../providers/simulatedDeviceProvider.js'
import { SNAPSHOT_EVERY_SIM_MINUTES, historyLog } from './historyLog.js'
import { recordHistoryAfterTick } from './recordFromSimulation.js'

describe('recordHistoryAfterTick', () => {
  it('writes simulated per-field snapshots with that field’s crop and water use', async () => {
    historyLog.resetForTests()
    const provider = new SimulatedDeviceProvider()
    await provider.setZoneValve('zone-a', true)

    for (let i = 0; i < SNAPSHOT_EVERY_SIM_MINUTES; i += 1) {
      provider.tick(1)
      await recordHistoryAfterTick(provider, 1)
    }

    const records = historyLog.list()
    expect(records.length).toBe(2)
    expect(records.every((r) => r.tag === 'simulated')).toBe(true)

    const zoneA = records.find((r) => r.zoneId === 'zone-a')
    const zoneB = records.find((r) => r.zoneId === 'zone-b')
    expect(zoneA?.cropName).toBe('Maize')
    expect(zoneA?.wateringAction).toBe('watering')
    expect(zoneA?.waterUsedL).toBeGreaterThan(0)
    expect(zoneB?.cropName).toBe('Tomato')
    expect(zoneB?.wateringAction).toBe('idle')
    expect(zoneB?.waterUsedL).toBe(0)
  })
})
