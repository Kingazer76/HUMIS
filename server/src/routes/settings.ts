import type { SettingsActionResult, SettingsSnapshot } from '@aquaflow/shared'
import { Router } from 'express'
import {
  applyFarmLocation,
  applyTankSettings,
  getDefaultFarmLocation,
  getDefaultTankConfig,
  getFarmLocation,
  getTankConfig,
  restoreDefaultFarmLocation,
  restoreDefaultTankSettings,
} from '../config/farmSettings.js'
import { applyZoneSettingsPatch } from '../config/zoneSettings.js'
import { CROP_PROFILES } from '../config/seedData.js'
import { deviceProvider, simulatedProvider } from '../providers/index.js'

export const settingsRouter = Router()

function simulationRequired(): SettingsActionResult | null {
  if (simulatedProvider) return null
  return { ok: false, reason: 'Settings can only be changed on the simulated farm right now.' }
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
    }
    res.json(snapshot)
  } catch (error) {
    next(error)
  }
})

settingsRouter.put('/tank', (req, res) => {
  const blocked = simulationRequired()
  if (blocked) {
    res.json(blocked)
    return
  }

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
  const blocked = simulationRequired()
  if (blocked) {
    res.json(blocked)
    return
  }

  const result = restoreDefaultTankSettings()
  if (result.ok) {
    simulatedProvider?.applyTankCapacity(result.config.capacityL)
    const payload: SettingsActionResult = { ok: true, reason: result.reason, tank: result.config }
    res.json(payload)
    return
  }
  res.json({ ok: false, reason: result.reason } satisfies SettingsActionResult)
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
    const blocked = simulationRequired()
    if (blocked) {
      res.json(blocked)
      return
    }

    const current = await simulatedProvider!.getZoneConfig(String(req.params.id))
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
    })
    if (!result.ok) {
      const payload: SettingsActionResult = { ok: false, reason: result.reason }
      res.json(payload)
      return
    }

    simulatedProvider!.updateZoneConfig(result.config)
    const payload: SettingsActionResult = { ok: true, reason: result.reason, zone: result.config }
    res.json(payload)
  } catch (error) {
    next(error)
  }
})

settingsRouter.post('/zones/:id/reset', async (req, res, next) => {
  try {
    const blocked = simulationRequired()
    if (blocked) {
      res.json(blocked)
      return
    }

    const reset = simulatedProvider!.resetZoneConfig(String(req.params.id))
    if (!reset) {
      const payload: SettingsActionResult = { ok: false, reason: 'That field is not on this farm.' }
      res.json(payload)
      return
    }

    const zone = await simulatedProvider!.getZoneConfig(String(req.params.id))
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
