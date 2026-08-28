import { describe, expect, it } from 'vitest'
import type { CropProfile, IrrigationZone, SoilId } from '@aquaflow/shared'
import { getCropProfile } from '../agronomy/cropCatalog.js'
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

function agronomicZone(
  crop: CropProfile,
  soilId: SoilId,
  growthStageId: string,
  moisturePct: number,
  active: boolean,
): IrrigationZone {
  return {
    ...zone(moisturePct, active),
    cropId: crop.id,
    crop,
    soilId,
    growthStageId,
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

  it('shifts start/stop targets down when the watering style is save-water', () => {
    const saving: IrrigationZone = { ...zone(38, false), irrigationPreference: 'water-saving' }
    // Crop default min is 40; save-water uses 35. 38% is still above 35, so hold.
    expect(decideZoneIrrigation({ zone: saving, ...HEALTHY_TANK }).action).toBe('hold')
    expect(decideZoneIrrigation({ zone: { ...saving, state: { ...saving.state, soilMoisturePct: { ...saving.state.soilMoisturePct, value: 35 } } }, ...HEALTHY_TANK }).action).toBe('start')
  })

  it('shifts start/stop targets up when the watering style is extra watering', () => {
    const extra: IrrigationZone = { ...zone(44, false), irrigationPreference: 'aggressive' }
    // Crop default min is 40; extra watering uses 45. 44% is dry enough to start.
    expect(decideZoneIrrigation({ zone: extra, ...HEALTHY_TANK }).action).toBe('start')
    const wetEnough: IrrigationZone = {
      ...zone(65, true),
      irrigationPreference: 'aggressive',
    }
    expect(decideZoneIrrigation({ zone: wetEnough, ...HEALTHY_TANK }).action).toBe('stop')
  })

  it('applies save-water on top of moisture overrides', () => {
    const zoneWithBoth: IrrigationZone = {
      ...zone(28, false),
      irrigationPreference: 'water-saving',
      overrideMinPct: 30,
      overrideMaxPct: 50,
    }
    // Override min 30, then -5 → 25. 28% is still above 25.
    expect(decideZoneIrrigation({ zone: zoneWithBoth, ...HEALTHY_TANK }).action).toBe('hold')
  })

  it('uses a different start line on sand than on clay for the same crop and stage', () => {
    const tomato = getCropProfile('tomato')!
    const sand = decideZoneIrrigation({
      zone: agronomicZone(tomato, 'sand', 'mid', 40, false),
      ...HEALTHY_TANK,
    })
    const clay = decideZoneIrrigation({
      zone: agronomicZone(tomato, 'clay', 'mid', 40, false),
      ...HEALTHY_TANK,
    })
    expect(sand.triggerPct).not.toBe(clay.triggerPct)
    expect(sand.status).toBeDefined()
  })

  it('uses a different start line at establishment than at mid-season', () => {
    const maizeCrop = getCropProfile('maize')!
    const initial = decideZoneIrrigation({
      zone: agronomicZone(maizeCrop, 'loam', 'initial', 40, false),
      ...HEALTHY_TANK,
    })
    const mid = decideZoneIrrigation({
      zone: agronomicZone(maizeCrop, 'loam', 'mid', 40, false),
      ...HEALTHY_TANK,
    })
    expect(initial.triggerPct).not.toBe(mid.triggerPct)
  })

  it('delays a start when substantial rain is expected and the crop can wait', () => {
    const decision = decideZoneIrrigation({
      zone: zone(35, false),
      ...HEALTHY_TANK,
      forecast: {
        expectedRainfallMm: 12,
        precipitationProbabilityPct: 70,
        condition: 'rain',
      },
    })
    expect(decision.action).toBe('hold')
    expect(decision.status).toBe('monitor')
    expect(decision.reason).toMatch(/rain/i)
  })

  it('still starts when soil is urgently dry even if rain is expected', () => {
    const decision = decideZoneIrrigation({
      zone: zone(30, false),
      ...HEALTHY_TANK,
      forecast: {
        expectedRainfallMm: 12,
        precipitationProbabilityPct: 70,
        condition: 'rain',
      },
    })
    expect(decision.action).toBe('start')
    expect(decision.status).toBe('irrigation-urgent')
  })

  it('delays a start when recent rainfall is significant and the crop can wait', () => {
    const decision = decideZoneIrrigation({
      zone: zone(35, false),
      ...HEALTHY_TANK,
      forecast: {
        expectedRainfallMm: 0,
        precipitationProbabilityPct: 10,
        condition: 'clear',
        recentRainfallMm: 8,
      },
    })
    expect(decision.action).toBe('hold')
    expect(decision.status).toBe('monitor')
    expect(decision.reason).toMatch(/recently/i)
  })

  it('withholds a start when the main tank has too little stored water', () => {
    const decision = decideZoneIrrigation({
      zone: zone(30, false),
      ...HEALTHY_TANK,
      availableTankL: 5,
    })
    expect(decision.action).toBe('hold')
    expect(decision.status).toBe('irrigation-limited-by-water')
    expect(decision.reason).toMatch(/tank/i)
  })

  it('still forces a stop at the critical tank level for an agronomic crop', () => {
    const tomato = getCropProfile('tomato')!
    const decision = decideZoneIrrigation({
      zone: agronomicZone(tomato, 'loam', 'mid', 20, true),
      tankLevelPct: 10,
      criticalThresholdPct: 15,
      availableTankL: 1000,
    })
    expect(decision.action).toBe('stop')
    expect(decision.status).toBe('irrigation-limited-by-water')
  })
})
