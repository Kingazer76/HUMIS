import type { FarmLocation, TankConfig } from '@aquaflow/shared'
import { readFarmLocationFromEnv } from '../env.js'
import { FARM_LOCATION as DEFAULT_FARM_LOCATION, TANK_CONFIG as DEFAULT_TANK_CONFIG } from './seedData.js'

let tankConfig: TankConfig = { ...DEFAULT_TANK_CONFIG }
let farmLocation: FarmLocation = readFarmLocationFromEnv() ?? { ...DEFAULT_FARM_LOCATION }

export function getTankConfig(): TankConfig {
  return { ...tankConfig }
}

export function getDefaultTankConfig(): TankConfig {
  return { ...DEFAULT_TANK_CONFIG }
}

export function getFarmLocation(): FarmLocation {
  return { ...farmLocation }
}

export function getDefaultFarmLocation(): FarmLocation {
  return { ...DEFAULT_FARM_LOCATION }
}

export type TankSettingsResult =
  | { ok: true; reason: string; config: TankConfig }
  | { ok: false; reason: string }

/**
 * Validates tank numbers without writing them. Rejects bad input so the
 * live farm config cannot be corrupted.
 */
export function validateTankSettings(input: {
  capacityL?: unknown
  lowThresholdPct?: unknown
  criticalThresholdPct?: unknown
}): TankSettingsResult {
  const capacityL = Number(input.capacityL)
  const lowThresholdPct = Number(input.lowThresholdPct)
  const criticalThresholdPct = Number(input.criticalThresholdPct)

  if (!Number.isFinite(capacityL) || capacityL <= 0) {
    return { ok: false, reason: 'Tank size must be greater than 0 litres.' }
  }
  if (!Number.isFinite(lowThresholdPct) || lowThresholdPct < 0 || lowThresholdPct >= 100) {
    return { ok: false, reason: 'The low-water warning must be 0% or more, and below 100%.' }
  }
  if (!Number.isFinite(criticalThresholdPct) || criticalThresholdPct < 0 || criticalThresholdPct >= 100) {
    return { ok: false, reason: 'The stop-watering level must be 0% or more, and below 100%.' }
  }
  if (criticalThresholdPct >= lowThresholdPct) {
    return { ok: false, reason: 'The stop-watering level must be below the low-water warning.' }
  }

  return {
    ok: true,
    reason: 'Tank settings saved.',
    config: { capacityL, lowThresholdPct, criticalThresholdPct },
  }
}

export function applyTankSettings(input: {
  capacityL?: unknown
  lowThresholdPct?: unknown
  criticalThresholdPct?: unknown
}): TankSettingsResult {
  const result = validateTankSettings(input)
  if (!result.ok) return result
  tankConfig = result.config
  return result
}

export function restoreDefaultTankSettings(): TankSettingsResult {
  tankConfig = { ...DEFAULT_TANK_CONFIG }
  return { ok: true, reason: 'Tank settings restored to the usual farm defaults.', config: getTankConfig() }
}

export type LocationSettingsResult =
  | { ok: true; reason: string; location: FarmLocation }
  | { ok: false; reason: string }

/**
 * Validates farm coordinates without writing them. The weather forecast
 * uses whatever location is stored here.
 */
export function validateFarmLocation(input: {
  latitude?: unknown
  longitude?: unknown
  label?: unknown
}): LocationSettingsResult {
  const latitude = Number(input.latitude)
  const longitude = Number(input.longitude)
  const label = typeof input.label === 'string' ? input.label.trim() : ''

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    return { ok: false, reason: 'Latitude must be a number between -90 and 90.' }
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return { ok: false, reason: 'Longitude must be a number between -180 and 180.' }
  }
  if (label.length > 80) {
    return { ok: false, reason: 'The place name must be 80 characters or fewer.' }
  }

  return {
    ok: true,
    reason: 'Farm location saved. The weather forecast will use this place.',
    location: { latitude, longitude, label: label || 'Farm location' },
  }
}

export function applyFarmLocation(input: {
  latitude?: unknown
  longitude?: unknown
  label?: unknown
}): LocationSettingsResult {
  const result = validateFarmLocation(input)
  if (!result.ok) return result
  farmLocation = result.location
  return result
}

export function restoreDefaultFarmLocation(): { ok: true; reason: string; location: FarmLocation } {
  farmLocation = { ...DEFAULT_FARM_LOCATION }
  return {
    ok: true,
    reason: 'Farm location restored to the usual farm default.',
    location: getFarmLocation(),
  }
}

/** Test isolation — the live farm config is process-wide, like the simulation. */
export function resetFarmSettingsForTests(): void {
  tankConfig = { ...DEFAULT_TANK_CONFIG }
  farmLocation = { ...DEFAULT_FARM_LOCATION }
}
