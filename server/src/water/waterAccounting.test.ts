import { describe, expect, it } from 'vitest'
import type { TankConfig, TankState, WaterSource } from '@aquaflow/shared'
import { buildWaterSnapshot } from './waterAccounting.js'

const tankConfig: TankConfig = { capacityL: 15000, lowThresholdPct: 25, criticalThresholdPct: 15 }

function tankState(levelL: number): TankState {
  return { levelL: { value: levelL, tag: 'simulated', asOf: new Date().toISOString() } }
}

function source(id: string, currentL: number, active = true): WaterSource {
  return {
    id,
    name: id,
    kind: 'well',
    capacityL: 10000,
    nominalTransferRateLPerMin: 1,
    state: { id, currentL: { value: currentL, tag: 'simulated', asOf: new Date().toISOString() }, active },
  }
}

describe('buildWaterSnapshot', () => {
  it('never reports main tank water above capacity', () => {
    const snapshot = buildWaterSnapshot({
      tank: tankState(999999),
      tankConfig,
      sources: [],
      waterInLPerMin: 0,
      waterUsedLPerMin: 0,
      inflowSinceStartL: 0,
      usedSinceStartL: 0,
      flowInputSource: 'configured-rate',
    })
    expect(snapshot.mainTankL.value).toBeLessThanOrEqual(tankConfig.capacityL)
  })

  it('never reports main tank water below zero', () => {
    const snapshot = buildWaterSnapshot({
      tank: tankState(-500),
      tankConfig,
      sources: [],
      waterInLPerMin: 0,
      waterUsedLPerMin: 0,
      inflowSinceStartL: 0,
      usedSinceStartL: 0,
      flowInputSource: 'configured-rate',
    })
    expect(snapshot.mainTankL.value).toBeGreaterThanOrEqual(0)
  })

  it('total available water equals main tank plus every source, regardless of active flag', () => {
    const sources = [source('a', 1000, true), source('b', 2500, false)]
    const snapshot = buildWaterSnapshot({
      tank: tankState(9000),
      tankConfig,
      sources,
      waterInLPerMin: 0,
      waterUsedLPerMin: 0,
      inflowSinceStartL: 0,
      usedSinceStartL: 0,
      flowInputSource: 'configured-rate',
    })
    expect(snapshot.transferableSourceL.value).toBe(3500)
    expect(snapshot.totalAvailableL.value).toBe(9000 + 3500)
  })

  it('tags Water In / Water Used / totals as estimated with the given flow input source, never as measured', () => {
    const snapshot = buildWaterSnapshot({
      tank: tankState(9000),
      tankConfig,
      sources: [],
      waterInLPerMin: 3,
      waterUsedLPerMin: 1.5,
      inflowSinceStartL: 42,
      usedSinceStartL: 17,
      flowInputSource: 'configured-rate',
    })
    for (const reading of [
      snapshot.waterInLPerMin,
      snapshot.waterUsedLPerMin,
      snapshot.inflowSinceStartL,
      snapshot.usedSinceStartL,
    ]) {
      expect(reading.tag).toBe('estimated')
      expect(reading.tag).not.toBe('measured')
      expect(reading.flowInputSource).toBe('configured-rate')
    }
  })

  it('tags main tank water with the tank reading tag it was given (simulated here, measured once real hardware exists)', () => {
    const snapshot = buildWaterSnapshot({
      tank: tankState(9000),
      tankConfig,
      sources: [],
      waterInLPerMin: 0,
      waterUsedLPerMin: 0,
      inflowSinceStartL: 0,
      usedSinceStartL: 0,
      flowInputSource: 'configured-rate',
    })
    expect(snapshot.mainTankL.tag).toBe('simulated')
  })
})
