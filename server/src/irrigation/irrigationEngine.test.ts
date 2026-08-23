import { describe, expect, it } from 'vitest'
import type { CropProfile, IrrigationZone } from '@aquaflow/shared'
import { decideZoneIrrigation } from './irrigationEngine.js'

const maize: CropProfile = { id: 'maize', name: 'Maize', defaultMinMoisturePct: 40, defaultMaxMoisturePct: 60, priority: 'medium' }

function zone(moisturePct: number, active: boolean): IrrigationZone {
  return {
    id: 'zone-a',
    name: 'Zone A',
    cropId: 'maize',
    sensorMode: 'default',
    irrigationPreference: 'standard',
    nominalOutflowRateLPerMin: 5,
    crop: maize,
    state: {
      id: 'zone-a',
      soilMoisturePct: { value: moisturePct, tag: 'simulated', asOf: new Date().toISOString() },
      active,
      lastWateredAt: null,
    },
  }
}

const HEALTHY_TANK = { tankLevelPct: 80, criticalThresholdPct: 15 }

describe('decideZoneIrrigation', () => {
  it('starts an inactive zone once moisture falls to the target minimum', () => {
    const decision = decideZoneIrrigation({ zone: zone(40, false), ...HEALTHY_TANK })
    expect(decision.action).toBe('start')
  })

  it('starts an inactive zone below the target minimum', () => {
    const decision = decideZoneIrrigation({ zone: zone(30, false), ...HEALTHY_TANK })
    expect(decision.action).toBe('start')
  })

  it('holds an inactive zone whose moisture is within the target range', () => {
    const decision = decideZoneIrrigation({ zone: zone(50, false), ...HEALTHY_TANK })
    expect(decision.action).toBe('hold')
  })

  it('holds an active zone until moisture reaches the target maximum', () => {
    const decision = decideZoneIrrigation({ zone: zone(45, true), ...HEALTHY_TANK })
    expect(decision.action).toBe('hold')
  })

  it('stops an active zone once moisture reaches the target maximum', () => {
    const decision = decideZoneIrrigation({ zone: zone(60, true), ...HEALTHY_TANK })
    expect(decision.action).toBe('stop')
  })

  it('does not toggle more than once while an oscillating reading stays within the hysteresis band', () => {
    // A zone starts once at 40 (min), then the reading jitters around the
    // middle of the band on every subsequent tick. A single-threshold rule
    // (e.g. "on below 50") would flip on/off on almost every tick; the
    // min/max hysteresis band must not.
    let active = false
    const oscillatingReadings = [40, 41, 39.6, 40.4, 39.9, 40.2, 39.8, 40.1, 39.7, 40.3]
    let toggles = 0

    for (const moisture of oscillatingReadings) {
      const decision = decideZoneIrrigation({ zone: zone(moisture, active), ...HEALTHY_TANK })
      if (decision.action === 'start' && !active) {
        active = true
        toggles += 1
      } else if (decision.action === 'stop' && active) {
        active = false
        toggles += 1
      }
    }

    // Exactly one toggle expected: the very first reading (40) starts the
    // zone; every subsequent reading stays well below the 60% exit
    // threshold, so the zone should hold ON for the rest of the sequence.
    expect(toggles).toBe(1)
    expect(active).toBe(true)
  })

  it('forces a stop when the tank is at or below the critical threshold, regardless of moisture', () => {
    const decision = decideZoneIrrigation({
      zone: zone(30, true),
      tankLevelPct: 10,
      criticalThresholdPct: 15,
    })
    expect(decision.action).toBe('stop')
  })

  it('withholds a start when the tank is at or below the critical threshold, even if soil is dry', () => {
    const decision = decideZoneIrrigation({
      zone: zone(10, false),
      tankLevelPct: 15,
      criticalThresholdPct: 15,
    })
    expect(decision.action).toBe('hold')
  })

  it('respects per-zone override min/max instead of the crop default', () => {
    const overriddenZone: IrrigationZone = {
      ...zone(35, false),
      overrideMinPct: 30,
      overrideMaxPct: 50,
    }
    const decision = decideZoneIrrigation({ zone: overriddenZone, ...HEALTHY_TANK })
    // 35% is above the override minimum (30%) even though it's below the crop default (40%).
    expect(decision.action).toBe('hold')
  })
})
