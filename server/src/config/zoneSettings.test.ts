import { describe, expect, it } from 'vitest'
import { CROP_PROFILES, IRRIGATION_ZONE_CONFIGS } from './seedData.js'
import { applyZoneSettingsPatch } from './zoneSettings.js'
import type { SoilId } from '@aquaflow/shared'

const zoneA = { ...IRRIGATION_ZONE_CONFIGS[0]! }

describe('applyZoneSettingsPatch', () => {
  it('renames a field and changes its crop', () => {
    const result = applyZoneSettingsPatch(zoneA, { name: 'North maize', cropId: 'tomato' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.config.name).toBe('North maize')
    expect(result.config.cropId).toBe('tomato')
    expect(zoneA.name).toBe('Zone A — North Field')
    expect(IRRIGATION_ZONE_CONFIGS[0]!.name).toBe('Zone A — North Field')
  })

  it('rejects an empty name without changing the current config', () => {
    const result = applyZoneSettingsPatch(zoneA, { name: '   ' })
    expect(result.ok).toBe(false)
    expect(zoneA.name).toBe('Zone A — North Field')
  })

  it('rejects an unknown crop', () => {
    const result = applyZoneSettingsPatch(zoneA, { cropId: 'not-a-real-crop' })
    expect(result.ok).toBe(false)
  })

  it('saves soil type and growth stage', () => {
    const result = applyZoneSettingsPatch(zoneA, { soilId: 'sandy-loam', growthStageId: 'initial' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.config.soilId).toBe('sandy-loam')
    expect(result.config.growthStageId).toBe('initial')
  })

  it('rejects an unknown soil type', () => {
    const result = applyZoneSettingsPatch(zoneA, { soilId: 'peat' as SoilId })
    expect(result.ok).toBe(false)
  })

  it('falls back to mid-season when the growth stage is not on the crop', () => {
    const result = applyZoneSettingsPatch(zoneA, { cropId: 'tomato', growthStageId: 'not-a-stage' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.config.growthStageId).toBe('mid')
  })

  it('saves a watering style', () => {
    const result = applyZoneSettingsPatch(zoneA, { irrigationPreference: 'water-saving' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.config.irrigationPreference).toBe('water-saving')
  })

  it('saves soil target overrides when the dry number is below the wet number', () => {
    const result = applyZoneSettingsPatch(zoneA, { overrideMinPct: 20, overrideMaxPct: 35 })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.config.overrideMinPct).toBe(20)
    expect(result.config.overrideMaxPct).toBe(35)
  })

  it('rejects soil targets where the dry number is not below the wet number', () => {
    const result = applyZoneSettingsPatch(zoneA, { overrideMinPct: 60, overrideMaxPct: 50 })
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/dry-soil/i)
  })

  it('rejects an override that would sit at or above the crop wet-enough default', () => {
    const maize = CROP_PROFILES.find((c) => c.id === 'maize')!
    const result = applyZoneSettingsPatch(zoneA, { cropId: 'maize', overrideMinPct: maize.defaultMaxMoisturePct })
    expect(result.ok).toBe(false)
  })

  it('clears soil overrides when they are sent empty', () => {
    const withOverrides = applyZoneSettingsPatch(zoneA, { overrideMinPct: 20, overrideMaxPct: 35 })
    expect(withOverrides.ok).toBe(true)
    if (!withOverrides.ok) return
    const cleared = applyZoneSettingsPatch(withOverrides.config, { overrideMinPct: null, overrideMaxPct: null })
    expect(cleared.ok).toBe(true)
    if (!cleared.ok) return
    expect(cleared.config.overrideMinPct).toBeUndefined()
    expect(cleared.config.overrideMaxPct).toBeUndefined()
  })
})
