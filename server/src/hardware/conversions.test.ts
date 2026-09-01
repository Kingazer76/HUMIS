import { describe, expect, it } from 'vitest'
import { DEFAULT_HARDWARE_CALIBRATION } from '@aquaflow/shared'
import { soilAdcToPercent, tankDistanceToLitres } from './conversions.js'

const capacityL = 15000

describe('tankDistanceToLitres', () => {
  it('converts a mid-tank distance using empty/full calibration, not a hardcoded tank shape', () => {
    const litres = tankDistanceToLitres(42, DEFAULT_HARDWARE_CALIBRATION, capacityL)
    expect(litres).toBeCloseTo(((100 - 42) / (100 - 20)) * capacityL, 5)
  })

  it('returns null for a missing or out-of-range ultrasonic reading', () => {
    expect(tankDistanceToLitres(null, DEFAULT_HARDWARE_CALIBRATION, capacityL)).toBeNull()
    expect(tankDistanceToLitres(0, DEFAULT_HARDWARE_CALIBRATION, capacityL)).toBeNull()
    expect(tankDistanceToLitres(900, DEFAULT_HARDWARE_CALIBRATION, capacityL)).toBeNull()
  })

  it('clamps to an empty or full tank at the calibrated distances', () => {
    expect(tankDistanceToLitres(100, DEFAULT_HARDWARE_CALIBRATION, capacityL)).toBe(0)
    expect(tankDistanceToLitres(20, DEFAULT_HARDWARE_CALIBRATION, capacityL)).toBe(capacityL)
  })
})

describe('soilAdcToPercent', () => {
  it('converts Zone A ADC using dry/wet calibration', () => {
    const pct = soilAdcToPercent(1800, DEFAULT_HARDWARE_CALIBRATION)
    expect(pct).toBeCloseTo(((3000 - 1800) / (3000 - 1200)) * 100, 5)
  })

  it('returns null for a missing or out-of-range ADC', () => {
    expect(soilAdcToPercent(null, DEFAULT_HARDWARE_CALIBRATION)).toBeNull()
    expect(soilAdcToPercent(-1, DEFAULT_HARDWARE_CALIBRATION)).toBeNull()
    expect(soilAdcToPercent(9000, DEFAULT_HARDWARE_CALIBRATION)).toBeNull()
  })
})
