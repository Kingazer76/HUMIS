import type { IrrigationAdviceSnapshot, ZoneIrrigationAdvice } from '@aquaflow/shared'
import { getSoil } from '@aquaflow/shared'
import { getTankConfig } from '../config/farmSettings.js'
import { getForecastSafely } from '../forecast/weatherProvider.js'
import { ACTIVE_FLOW_INPUT_SOURCE } from '../providers/flowInputSource.js'
import { deviceProvider } from '../providers/index.js'
import { decideZoneIrrigation } from './irrigationEngine.js'

/**
 * Farmer-facing per-zone advice from the same `decideZoneIrrigation`
 * function Auto mode uses. Never opens valves itself.
 */
export async function buildIrrigationAdvice(): Promise<IrrigationAdviceSnapshot> {
  const [tank, zones, rain] = await Promise.all([
    deviceProvider.getTankLevel(),
    deviceProvider.getZones(),
    deviceProvider.getRainStatus(),
  ])
  const forecast = await getForecastSafely()
  const tankConfig = getTankConfig()
  const tankLevelPct = (tank.levelL.value / tankConfig.capacityL) * 100
  const availableTankL = tank.levelL.value

  const advice: ZoneIrrigationAdvice[] = zones.map((zone) => {
    const decision = decideZoneIrrigation({
      zone,
      tankLevelPct,
      criticalThresholdPct: tankConfig.criticalThresholdPct,
      availableTankL,
      isRaining: rain.isRaining.value,
      forecast: forecast
        ? {
            expectedRainfallMm: forecast.expectedRainfallMm,
            precipitationProbabilityPct: forecast.precipitationProbabilityPct ?? 0,
            condition: forecast.condition,
            temperatureC: forecast.temperatureC,
            recentRainfallMm: forecast.precipitationMm ?? 0,
          }
        : undefined,
    })
    const stage =
      zone.crop.stages?.find((s) => s.id === zone.growthStageId) ??
      zone.crop.stages?.find((s) => s.id === 'mid')
    return {
      zoneId: zone.id,
      zoneName: zone.name,
      status: decision.status,
      reason: decision.reason,
      cropName: zone.crop.name,
      soilName: getSoil(zone.soilId).name,
      growthStageName: stage?.name ?? 'Mid-season',
      moisturePct: zone.state.soilMoisturePct.value,
      triggerPct: decision.triggerPct,
      stopPct: decision.stopPct,
      kc: decision.kc,
      estimatedNeedL: decision.estimatedNeedL,
      estimatedDurationMin: decision.estimatedDurationMin,
      availableTankL: Math.round(availableTankL),
      nextCheckHours: decision.nextCheckHours,
      weatherApplied: decision.weatherApplied,
      flowInputSource: ACTIVE_FLOW_INPUT_SOURCE,
    }
  })

  return { zones: advice }
}
