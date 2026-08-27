import { describe, expect, it } from 'vitest'
import type { TankConfig, TankState, WaterSource } from '@aquaflow/shared'
import { buildWaterSnapshot } from './waterAccounting.js'

const tankConfig: TankConfig = { capacityL: 15000, lowThresholdPct: 25, criticalThresholdPct: 15 }

function tankState(levelL: number): TankState {
  return { levelL: { value: levelL, tag: 'simulated', asOf: new Date().toISOString() } }
}

function source(
  id: string,
  currentL: number,
  active = true,
  extras: Partial<WaterSource> = {},
): WaterSource {
  return {
    id,
    name: id,
    kind: 'well',
    capacityL: 10000,
    hasOwnStorage: true,
    nominalTransferRateLPerMin: 1,
    state: { id, currentL: { value: currentL, tag: 'simulated', asOf: new Date().toISOString() }, active },
    ...extras,
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

  it('available water equals the main tank only, not external source reserves', () => {
    const sources = [source('a', 1000, true), source('b', 2500, false)]
    const snapshot = buildWaterSnapshot({
      tank: tankState(5500),
      tankConfig,
      sources,
      waterInLPerMin: 0,
      waterUsedLPerMin: 0,
      inflowSinceStartL: 0,
      usedSinceStartL: 0,
      flowInputSource: 'configured-rate',
    })
    expect(snapshot.mainTankL.value).toBe(5500)
    expect(snapshot.transferableSourceL.value).toBe(3500)
    expect(snapshot.totalAvailableL.value).toBe(5500)
  })

  it('does not count rainwater or other sources as available water', () => {
    const sources = [
      source('rainwater-harvesting', 1000, true, {
        kind: 'rainwater',
        hasOwnStorage: false,
        capacityL: 0,
      }),
      source('well-borehole', 3000, true),
      source('reservoir-pond', 2000, false, { kind: 'reservoir' }),
    ]
    const snapshot = buildWaterSnapshot({
      tank: tankState(5500),
      tankConfig,
      sources,
      waterInLPerMin: 0,
      waterUsedLPerMin: 0,
      inflowSinceStartL: 0,
      usedSinceStartL: 0,
      flowInputSource: 'configured-rate',
    })
    expect(snapshot.mainTankL.value).toBe(5500)
    expect(snapshot.transferableSourceL.value).toBe(5000)
    expect(snapshot.totalAvailableL.value).toBe(5500)
  })

  it('clamps available water to the configured main-tank capacity', () => {
    const snapshot = buildWaterSnapshot({
      tank: tankState(9700),
      tankConfig: { ...tankConfig, capacityL: 20 },
      sources: [source('well-borehole', 10000, true)],
      waterInLPerMin: 0,
      waterUsedLPerMin: 0,
      inflowSinceStartL: 0,
      usedSinceStartL: 0,
      flowInputSource: 'configured-rate',
    })
    expect(snapshot.mainTankL.value).toBe(20)
    expect(snapshot.totalAvailableL.value).toBe(20)
    expect(snapshot.transferableSourceL.value).toBe(10000)
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

  it('case 1: 5,500 L in the tank and 5,000 L in external sources → available is 5,500 L', () => {
    const snapshot = buildWaterSnapshot({
      tank: tankState(5500),
      tankConfig,
      sources: [source('well', 3000), source('pond', 2000, false, { kind: 'reservoir' })],
      waterInLPerMin: 0,
      waterUsedLPerMin: 0,
      inflowSinceStartL: 0,
      usedSinceStartL: 0,
      flowInputSource: 'configured-rate',
    })
    expect(snapshot.totalAvailableL.value).toBe(5500)
  })

  it('case 2: 20 L tank at 20 L with 10,000 L in external sources → available is 20 L', () => {
    const snapshot = buildWaterSnapshot({
      tank: tankState(20),
      tankConfig: { ...tankConfig, capacityL: 20 },
      sources: [source('well', 10000)],
      waterInLPerMin: 0,
      waterUsedLPerMin: 0,
      inflowSinceStartL: 0,
      usedSinceStartL: 0,
      flowInputSource: 'configured-rate',
    })
    expect(snapshot.totalAvailableL.value).toBe(20)
    expect(snapshot.mainTankL.value).toBe(20)
  })

  it('case 4: 5,500 L in the tank and no incoming water → available is 5,500 L', () => {
    const snapshot = buildWaterSnapshot({
      tank: tankState(5500),
      tankConfig,
      sources: [],
      waterInLPerMin: 0,
      waterUsedLPerMin: 0,
      inflowSinceStartL: 0,
      usedSinceStartL: 0,
      flowInputSource: 'configured-rate',
    })
    expect(snapshot.totalAvailableL.value).toBe(5500)
  })

  it('case 5: 5,500 L tank, well 3,000, pond 2,000, rain potential 1,000 → available is 5,500 L', () => {
    const snapshot = buildWaterSnapshot({
      tank: tankState(5500),
      tankConfig,
      sources: [
        source('rainwater-harvesting', 1000, true, {
          kind: 'rainwater',
          hasOwnStorage: false,
          capacityL: 0,
        }),
        source('well-borehole', 3000),
        source('reservoir-pond', 2000, false, { kind: 'reservoir' }),
      ],
      waterInLPerMin: 0,
      waterUsedLPerMin: 0,
      inflowSinceStartL: 0,
      usedSinceStartL: 0,
      flowInputSource: 'configured-rate',
    })
    expect(snapshot.transferableSourceL.value).toBe(5000)
    expect(snapshot.totalAvailableL.value).toBe(5500)
  })
})
