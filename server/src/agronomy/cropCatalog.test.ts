import { describe, expect, it } from 'vitest'
import { agronomicSensorBand, getSoil, SOIL_CATALOG } from '@aquaflow/shared'
import { CROP_PROFILES, getCropProfile } from './cropCatalog.js'

describe('crop catalog', () => {
  it('includes at least 50 Ghana-relevant crops with unique ids', () => {
    expect(CROP_PROFILES.length).toBeGreaterThanOrEqual(50)
    const ids = CROP_PROFILES.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('keeps maize and tomato with FAO-56 Kc, p, and rooting depth', () => {
    const maize = getCropProfile('maize')!
    const tomato = getCropProfile('tomato')!
    expect(maize.depletionFractionP?.source).toBe('fao-56')
    expect(tomato.depletionFractionP?.source).toBe('fao-56')
    expect(maize.rootingDepthM?.source).toBe('fao-56')
    expect(tomato.rootingDepthM?.source).toBe('fao-56')
    expect(maize.stages?.some((s) => s.kcSource === 'fao-56')).toBe(true)
    expect(tomato.stages?.some((s) => s.kcSource === 'fao-56')).toBe(true)
  })

  it('marks cassava p and rooting depth as assumptions', () => {
    const cassava = getCropProfile('cassava')!
    expect(cassava.depletionFractionP?.source).toBe('assumption')
    expect(cassava.rootingDepthM?.source).toBe('assumption')
    expect(cassava.assumptions?.some((note) => /analog/i.test(note))).toBe(true)
  })

  it('computes a different moisture start line on sand than on clay', () => {
    const tomato = getCropProfile('tomato')!
    const sand = agronomicSensorBand(
      {
        depletionFractionP: tomato.depletionFractionP!,
        stages: tomato.stages!,
        droughtSensitivity: tomato.droughtSensitivity,
      },
      getSoil('sand'),
      'mid',
    )
    const clay = agronomicSensorBand(
      {
        depletionFractionP: tomato.depletionFractionP!,
        stages: tomato.stages!,
        droughtSensitivity: tomato.droughtSensitivity,
      },
      getSoil('clay'),
      'mid',
    )
    expect(sand.minPct).not.toBe(clay.minPct)
    expect(SOIL_CATALOG).toHaveLength(6)
  })
})
