import type { SettingsActionResult, SettingsSnapshot } from '@aquaflow/shared'
import { Router } from 'express'
import {
  applyFarmLocation,
  applyHardwareCalibration,
  applyTankSettings,
  getDefaultFarmLocation,
  getDefaultHardwareCalibration,
  getDefaultTankConfig,
  getFarmLocation,
  getHardwareCalibration,
  getTankConfig,
  restoreDefaultFarmLocation,
  restoreDefaultHardwareCalibration,
  restoreDefaultTankSettings,
} from '../config/farmSettings.js'
import { applyZoneSettingsPatch } from '../config/zoneSettings.js'
import { CROP_PROFILES } from '../config/seedData.js'
import { SOIL_CATALOG } from '@aquaflow/shared'
import { USE_SIMULATED } from '../env.js'
import { hardwarePinMap } from '../hardware/gpioPins.js'
import { getLastTelemetry, setMaxPumpOnSeconds, telemetryAgeMs } from '../hardware/hardwareStore.js'
import { deviceProvider, esp32Provider, simulatedProvider } from '../providers/index.js'

export const settingsRouter = Router()

function liveFarmWriter() {
  return simulatedProvider ?? esp32Provider
}

function farmWriterRequired(): SettingsActionResult | null {
  if (liveFarmWriter()) return null
  return { ok: false, reason: 'Settings can only be changed while the farm is running.' }
}

function hardwareLinkStatus() {
  const telemetry = getLastTelemetry()
  const ageMs = telemetryAgeMs()
  return {
    useSimulated: USE_SIMULATED,
    lastTelemetryAt: telemetry ? new Date(telemetry.receivedAt).toISOString() : null,
    lastTelemetryAgeMs: ageMs,
    boardHeard: telemetry !== null,
    pins: hardwarePinMap(),
  }
}

settingsRouter.get('/', async (_req, res, next) => {
  try {
    const zones = await deviceProvider.getZones()
    const snapshot: SettingsSnapshot = {
      tank: getTankConfig(),
      tankDefaults: getDefaultTankConfig(),
      location: getFarmLocation(),
      locationDefaults: getDefaultFarmLocation(),
      zones,
      crops: CROP_PROFILES.map((c) => ({ ...c })),
      soils: SOIL_CATALOG.map((s) => ({ ...s })),
      hardwareCalibration: getHardwareCalibration(),
      hardwareCalibrationDefaults: getDefaultHardwareCalibration(),
      hardware: hardwareLinkStatus(),
    }
    res.json(snapshot)
  } catch (error) {
    next(error)
  }
})

settingsRouter.put('/tank', (req, res) => {
  const result = applyTankSettings({
    capacityL: req.body?.capacityL,
    lowThresholdPct: req.body?.lowThresholdPct,
    criticalThresholdPct: req.body?.criticalThresholdPct,
  })
  if (result.ok) {
    simulatedProvider?.applyTankCapacity(result.config.capacityL)
    const payload: SettingsActionResult = { ok: true, reason: result.reason, tank: result.config }
    res.json(payload)
    return
  }
  const payload: SettingsActionResult = { ok: false, reason: result.reason }
  res.json(payload)
})

settingsRouter.post('/tank/defaults', (_req, res) => {
  const result = restoreDefaultTankSettings()
  if (result.ok) {
    simulatedProvider?.applyTankCapacity(result.config.capacityL)
    const payload: SettingsActionResult = { ok: true, reason: result.reason, tank: result.config }
    res.json(payload)
    return
  }
  res.json({ ok: false, reason: result.reason } satisfies SettingsActionResult)
})

settingsRouter.put('/hardware-calibration', (req, res) => {
  const result = applyHardwareCalibration({
    tankEmptyDistanceCm: req.body?.tankEmptyDistanceCm,
    tankFullDistanceCm: req.body?.tankFullDistanceCm,
    soilDryAdc: req.body?.soilDryAdc,
    soilWetAdc: req.body?.soilWetAdc,
    relayActiveHigh: req.body?.relayActiveHigh,
    maxPumpOnSeconds: req.body?.maxPumpOnSeconds,
  })
  if (result.ok) {
    setMaxPumpOnSeconds(result.calibration.maxPumpOnSeconds)
    const payload: SettingsActionResult = {
      ok: true,
      reason: result.reason,
      hardwareCalibration: result.calibration,
    }
    res.json(payload)
    return
  }
  const payload: SettingsActionResult = { ok: false, reason: result.reason }
  res.json(payload)
})

settingsRouter.post('/hardware-calibration/defaults', (_req, res) => {
  const result = restoreDefaultHardwareCalibration()
  if (result.ok) {
    setMaxPumpOnSeconds(result.calibration.maxPumpOnSeconds)
  }
  const payload: SettingsActionResult = {
    ok: result.ok,
    reason: result.reason,
    hardwareCalibration: result.ok ? result.calibration : undefined,
  }
  res.json(payload)
})

settingsRouter.put('/location', (req, res) => {
  const result = applyFarmLocation({
    latitude: req.body?.latitude,
    longitude: req.body?.longitude,
    label: req.body?.label,
  })
  if (result.ok) {
    const payload: SettingsActionResult = { ok: true, reason: result.reason, location: result.location }
    res.json(payload)
    return
  }
  const payload: SettingsActionResult = { ok: false, reason: result.reason }
  res.json(payload)
})

settingsRouter.post('/location/defaults', (_req, res) => {
  const result = restoreDefaultFarmLocation()
  const payload: SettingsActionResult = { ok: true, reason: result.reason, location: result.location }
  res.json(payload)
})

settingsRouter.put('/zones/:id', async (req, res, next) => {
  try {
    const blocked = farmWriterRequired()
    if (blocked) {
      res.json(blocked)
      return
    }
    const writer = liveFarmWriter()!

    const current = await writer.getZoneConfig(String(req.params.id))
    if (!current) {
      const payload: SettingsActionResult = { ok: false, reason: 'That field is not on this farm.' }
      res.json(payload)
      return
    }

    const result = applyZoneSettingsPatch(current, {
      name: req.body?.name,
      cropId: req.body?.cropId,
      irrigationPreference: req.body?.irrigationPreference,
      sensorMode: req.body?.sensorMode,
      overrideMinPct: req.body?.overrideMinPct,
      overrideMaxPct: req.body?.overrideMaxPct,
      soilId: req.body?.soilId,
      growthStageId: req.body?.growthStageId,
    })
    if (!result.ok) {
      const payload: SettingsActionResult = { ok: false, reason: result.reason }
      res.json(payload)
      return
    }

    writer.updateZoneConfig(result.config)
    const payload: SettingsActionResult = { ok: true, reason: result.reason, zone: result.config }
    res.json(payload)
  } catch (error) {
    next(error)
  }
})

settingsRouter.post('/zones/:id/reset', async (req, res, next) => {
  try {
    const blocked = farmWriterRequired()
    if (blocked) {
      res.json(blocked)
      return
    }
    const writer = liveFarmWriter()!

    const reset = writer.resetZoneConfig(String(req.params.id))
    if (!reset) {
      const payload: SettingsActionResult = { ok: false, reason: 'That field is not on this farm.' }
      res.json(payload)
      return
    }

    const zone = await writer.getZoneConfig(String(req.params.id))
    const payload: SettingsActionResult = {
      ok: true,
      reason: 'Field settings restored to the usual farm defaults.',
      zone,
    }
    res.json(payload)
  } catch (error) {
    next(error)
  }
})
