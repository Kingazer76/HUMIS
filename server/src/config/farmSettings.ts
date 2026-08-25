import type { TankConfig } from '@aquaflow/shared'
import { TANK_CONFIG as DEFAULT_TANK_CONFIG } from './seedData.js'

let tankConfig: TankConfig = { ...DEFAULT_TANK_CONFIG }

export function getTankConfig(): TankConfig {
  return { ...tankConfig }
}

export function getDefaultTankConfig(): TankConfig {
  return { ...DEFAULT_TANK_CONFIG }
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

/** Test isolation — the live farm config is process-wide, like the simulation. */
export function resetFarmSettingsForTests(): void {
  tankConfig = { ...DEFAULT_TANK_CONFIG }
}
