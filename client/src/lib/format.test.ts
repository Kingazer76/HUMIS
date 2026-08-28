import { describe, expect, it } from 'vitest'
import { farmerGrowthStageLabel, farmerSoilChoiceLabel, farmerSoilName } from './format'

describe('farmer-facing settings labels', () => {
  it('names soils in everyday words', () => {
    expect(farmerSoilName('sand')).toBe('Sandy soil')
    expect(farmerSoilName('loam')).toBe('Loamy soil')
    expect(farmerSoilName('clay')).toBe('Clay soil')
    expect(farmerSoilChoiceLabel('sand')).toMatch(/drains water quickly/)
    expect(farmerSoilChoiceLabel('loam')).toMatch(/holds water well/)
    expect(farmerSoilChoiceLabel('clay')).toMatch(/holds water for longer/)
  })

  it('maps growth-stage ids to everyday words without changing the ids', () => {
    expect(farmerGrowthStageLabel({ id: 'initial', name: 'Initial / establishment' })).toBe('Just planted')
    expect(farmerGrowthStageLabel({ id: 'vegetative', name: 'Vegetative' })).toBe('Growing leaves')
    expect(farmerGrowthStageLabel({ id: 'mid', name: 'Flowering / fruiting' })).toBe('Flowering / producing fruit')
    expect(farmerGrowthStageLabel({ id: 'late', name: 'Maturity' })).toBe('Ready for harvest')
  })
})
