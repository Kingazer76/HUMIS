import type { CropProfile, IrrigationPreference, IrrigationZoneConfig, SoilMoistureSensorMode } from '@aquaflow/shared'
import { CROP_PROFILES } from './seedData.js'

const PREFERENCES: IrrigationPreference[] = ['standard', 'water-saving', 'aggressive']
const SENSOR_MODES: SoilMoistureSensorMode[] = ['default', 'custom']

export interface ZoneSettingsInput {
  name: string
  cropId: string
  irrigationPreference: IrrigationPreference
  sensorMode?: SoilMoistureSensorMode
  overrideMinPct?: number | null
  overrideMaxPct?: number | null
}

export type ZoneSettingsResult =
  | { ok: true; reason: string; config: IrrigationZoneConfig }
  | { ok: false; reason: string }

function optionalPercent(value: unknown): { ok: true; value: number | undefined } | { ok: false; reason: string } {
  if (value === null || value === undefined || value === '') return { ok: true, value: undefined }
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    return { ok: false, reason: 'Soil targets must be between 0% and 100%.' }
  }
  return { ok: true, value: n }
}

export function applyZoneSettingsPatch(
  current: IrrigationZoneConfig,
  input: Partial<ZoneSettingsInput>,
  crops: CropProfile[] = CROP_PROFILES,
): ZoneSettingsResult {
  const name = input.name !== undefined ? String(input.name).trim() : current.name
  if (!name) return { ok: false, reason: 'Please give this field a name.' }

  const cropId = input.cropId !== undefined ? String(input.cropId) : current.cropId
  const crop = crops.find((c) => c.id === cropId)
  if (!crop) return { ok: false, reason: 'Please choose a crop that this farm knows.' }

  const irrigationPreference =
    input.irrigationPreference !== undefined ? input.irrigationPreference : current.irrigationPreference
  if (!PREFERENCES.includes(irrigationPreference)) {
    return { ok: false, reason: 'Please choose a watering style: usual, save water, or extra watering.' }
  }

  const sensorMode = input.sensorMode !== undefined ? input.sensorMode : current.sensorMode
  if (!SENSOR_MODES.includes(sensorMode)) {
    return { ok: false, reason: 'Sensor setting is not valid.' }
  }

  const minResult =
    input.overrideMinPct === undefined
      ? { ok: true as const, value: current.overrideMinPct }
      : optionalPercent(input.overrideMinPct)
  if (!minResult.ok) return minResult
  const maxResult =
    input.overrideMaxPct === undefined
      ? { ok: true as const, value: current.overrideMaxPct }
      : optionalPercent(input.overrideMaxPct)
  if (!maxResult.ok) return maxResult

  const effectiveMin = minResult.value ?? crop.defaultMinMoisturePct
  const effectiveMax = maxResult.value ?? crop.defaultMaxMoisturePct
  if (effectiveMin >= effectiveMax) {
    return { ok: false, reason: 'The dry-soil number must be below the wet-enough number.' }
  }

  const config: IrrigationZoneConfig = {
    ...current,
    name,
    cropId,
    irrigationPreference,
    sensorMode,
  }
  if (minResult.value === undefined) delete config.overrideMinPct
  else config.overrideMinPct = minResult.value
  if (maxResult.value === undefined) delete config.overrideMaxPct
  else config.overrideMaxPct = maxResult.value

  return { ok: true, reason: 'Field settings saved.', config }
}
