import type { HardwareCalibration } from '@aquaflow/shared'

const ESP32_ADC_MAX = 4095
const ULTRASONIC_MIN_CM = 2
const ULTRASONIC_MAX_CM = 400

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function isValidUltrasonicCm(distanceCm: number | null | undefined): distanceCm is number {
  return typeof distanceCm === 'number' && Number.isFinite(distanceCm) && distanceCm >= ULTRASONIC_MIN_CM && distanceCm <= ULTRASONIC_MAX_CM
}

export function isValidSoilAdc(adc: number | null | undefined): adc is number {
  return typeof adc === 'number' && Number.isFinite(adc) && adc >= 0 && adc <= ESP32_ADC_MAX
}

/**
 * Turns HC-SR04 distance into litres using the farmer's empty/full
 * distances and the tank size from Settings. Returns null when the
 * distance is unusable so HUMIS does not invent a tank level.
 */
export function tankDistanceToLitres(
  distanceCm: number | null | undefined,
  calibration: HardwareCalibration,
  capacityL: number,
): number | null {
  if (!isValidUltrasonicCm(distanceCm)) return null
  const empty = calibration.tankEmptyDistanceCm
  const full = calibration.tankFullDistanceCm
  if (!Number.isFinite(empty) || !Number.isFinite(full) || empty === full) return null
  if (!Number.isFinite(capacityL) || capacityL <= 0) return null
  const span = empty - full
  const fill = (empty - distanceCm) / span
  return clamp(fill * capacityL, 0, capacityL)
}

/**
 * Turns the Zone A analog reading into 0–100% wetness using the farmer's
 * dry/wet calibration. Returns null when the reading is unusable.
 */
export function soilAdcToPercent(
  adc: number | null | undefined,
  calibration: HardwareCalibration,
): number | null {
  if (!isValidSoilAdc(adc)) return null
  const dry = calibration.soilDryAdc
  const wet = calibration.soilWetAdc
  if (!Number.isFinite(dry) || !Number.isFinite(wet) || dry === wet) return null
  const pct = ((dry - adc) / (dry - wet)) * 100
  return clamp(pct, 0, 100)
}
