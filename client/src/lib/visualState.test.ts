import { describe, expect, it } from 'vitest'
import {
  deriveIrrigationVisualState,
  deriveShortageVisualState,
  deriveSoilVisualState,
  deriveTankVisualState,
  deriveWeatherVisualState,
} from './visualState'

describe('deriveSoilVisualState', () => {
  it('marks soil dry at or below the same dry target irrigation uses to start watering', () => {
    expect(deriveSoilVisualState(40, 40, 60, false)).toBe('dry')
    expect(deriveSoilVisualState(39.9, 40, 60, false)).toBe('dry')
  })

  it('marks soil healthy just above the dry target', () => {
    expect(deriveSoilVisualState(40.1, 40, 60, false)).toBe('healthy')
    expect(deriveSoilVisualState(50, 40, 60, false)).toBe('healthy')
    expect(deriveSoilVisualState(60, 40, 60, false)).toBe('healthy')
  })

  it('marks an active zone as irrigating even if soil is still dry', () => {
    expect(deriveSoilVisualState(30, 40, 60, true)).toBe('irrigating')
  })
})

describe('deriveTankVisualState', () => {
  const LOW = 25
  const CRITICAL = 15

  it('is critical at or below the stop-watering level', () => {
    expect(deriveTankVisualState(15, LOW, CRITICAL)).toBe('critical')
    expect(deriveTankVisualState(0, LOW, CRITICAL)).toBe('critical')
  })

  it('is low at or below the warning level, but still above critical', () => {
    expect(deriveTankVisualState(15.1, LOW, CRITICAL)).toBe('low')
    expect(deriveTankVisualState(25, LOW, CRITICAL)).toBe('low')
  })

  it('is high above the warning level', () => {
    expect(deriveTankVisualState(25.1, LOW, CRITICAL)).toBe('high')
    expect(deriveTankVisualState(80, LOW, CRITICAL)).toBe('high')
  })
})

describe('deriveWeatherVisualState', () => {
  it('shows rain when the rain reading is true', () => {
    expect(deriveWeatherVisualState({ isRaining: true })).toBe('rain')
  })

  it('shows normal when it is not raining (this farm has no hot-dry forecast yet)', () => {
    expect(deriveWeatherVisualState({ isRaining: false })).toBe('normal')
    expect(deriveWeatherVisualState({ isRaining: false, condition: 'clear' })).toBe('normal')
  })

  it('only shows hot-dry when a forecast actually says so', () => {
    expect(deriveWeatherVisualState({ isRaining: false, condition: 'hot-dry' })).toBe('hot-dry')
  })
})

describe('deriveIrrigationVisualState', () => {
  it('is running when the zone is watering', () => {
    expect(deriveIrrigationVisualState(true, true)).toBe('running')
    expect(deriveIrrigationVisualState(true, false)).toBe('running')
  })

  it('needs attention when soil is at the dry target and watering is off', () => {
    expect(deriveIrrigationVisualState(false, true)).toBe('needs-attention')
  })

  it('is healthy when watering is off and soil is above the dry target', () => {
    expect(deriveIrrigationVisualState(false, false)).toBe('healthy')
  })
})

describe('deriveShortageVisualState', () => {
  it('keeps the same shortage tier Planning already computed', () => {
    expect(deriveShortageVisualState('low')).toBe('low')
    expect(deriveShortageVisualState('moderate')).toBe('moderate')
    expect(deriveShortageVisualState('high')).toBe('high')
    expect(deriveShortageVisualState('critical')).toBe('critical')
  })
})
