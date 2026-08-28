import {
  agronomicSensorBand,
  getSoil,
  moistureTargetsForZone,
  sensorPctToVwc,
  type IrrigationAdviceStatus,
  type IrrigationZone,
  type WeatherCondition,
} from '@aquaflow/shared'

export { moistureTargetsForZone }

export type ZoneDecisionAction = 'start' | 'stop' | 'hold'

export interface IrrigationWeatherContext {
  expectedRainfallMm: number
  precipitationProbabilityPct: number
  condition: WeatherCondition
  temperatureC?: number
  /** Current/recent rain amount from the weather provider, if known. */
  recentRainfallMm?: number
}

export interface ZoneDecision {
  action: ZoneDecisionAction
  reason: string
  status: IrrigationAdviceStatus
  estimatedNeedL: number
  estimatedDurationMin: number
  nextCheckHours: number
  triggerPct: number
  stopPct: number
  kc: number
  weatherApplied: boolean
}

export interface ZoneDecisionInput {
  zone: IrrigationZone
  tankLevelPct: number
  criticalThresholdPct: number
  /** Main-tank litres only. External source reserves are not available water. */
  availableTankL?: number
  isRaining?: boolean
  forecast?: IrrigationWeatherContext
  /** Assumed wetted plot size when the zone has no area. Documented assumption. */
  plotAreaM2?: number
}

/** Default plot size when the zone does not store area. Assumption, not FAO. */
export const DEFAULT_PLOT_AREA_M2 = 500

function bandFor(zone: IrrigationZone): { minPct: number; maxPct: number; kc: number } {
  const { minPct, maxPct } = moistureTargetsForZone(zone)
  let kc = 1
  if (zone.crop.stages && zone.crop.stages.length > 0 && zone.crop.depletionFractionP) {
    kc = agronomicSensorBand(
      {
        depletionFractionP: zone.crop.depletionFractionP,
        stages: zone.crop.stages,
        droughtSensitivity: zone.crop.droughtSensitivity,
      },
      getSoil(zone.soilId),
      zone.growthStageId,
    ).kc
  }
  return { minPct, maxPct, kc }
}

function estimatedRefillL(
  zone: IrrigationZone,
  moisturePct: number,
  stopPct: number,
  plotAreaM2: number,
): number {
  const soil = getSoil(zone.soilId)
  const zr =
    zone.crop.rootingDepthM !== undefined
      ? (zone.crop.rootingDepthM.min + zone.crop.rootingDepthM.max) / 2
      : 0.8
  const current = sensorPctToVwc(moisturePct, soil)
  const target = sensorPctToVwc(stopPct, soil)
  const refillMm = Math.max(0, 1000 * (target - current) * zr)
  return refillMm * plotAreaM2
}

function nextCheckHours(status: IrrigationAdviceStatus, drainage: string, delayedForRain: boolean): number {
  if (status === 'irrigation-urgent') return 1
  if (delayedForRain) return 12
  if (drainage === 'fast') return 6
  if (drainage === 'slow') return 18
  return 12
}

/**
 * The single authority for "should this zone be irrigating right now?"
 * Pure function. `safetyController` is still the only writer of pump/valves.
 *
 * Thresholds come from crop + soil + growth stage (FAO-56 Kc and p, plus
 * the soil water table), not from one farm-wide moisture number. Weather
 * can delay a start. The main tank can limit a start. Hysteresis remains:
 * start at/below min, keep running until max.
 */
export function decideZoneIrrigation(input: ZoneDecisionInput): ZoneDecision {
  const { zone, tankLevelPct, criticalThresholdPct } = input
  const { minPct, maxPct, kc } = bandFor(zone)
  const moisture = zone.state.soilMoisturePct.value
  const active = zone.state.active
  const soil = getSoil(zone.soilId)
  const plotAreaM2 = Math.max(10, input.plotAreaM2 ?? DEFAULT_PLOT_AREA_M2)
  const availableTankL = Math.max(0, input.availableTankL ?? Number.POSITIVE_INFINITY)
  const refillL = estimatedRefillL(zone, moisture, maxPct, plotAreaM2)
  const belowMin = moisture <= minPct
  const atOrAboveMax = moisture >= maxPct
  const needL = belowMin || active ? refillL : 0
  const durationMin =
    zone.nominalOutflowRateLPerMin > 0 ? needL / zone.nominalOutflowRateLPerMin : 0

  const forecast = input.forecast
  const weatherApplied = forecast !== undefined || input.isRaining === true
  const rainSoon =
    forecast !== undefined &&
    forecast.expectedRainfallMm >= 8 &&
    forecast.precipitationProbabilityPct >= 50
  const recentRain = (forecast?.recentRainfallMm ?? 0) >= 5
  const hotDry = forecast?.condition === 'hot-dry' || (forecast?.temperatureC !== undefined && forecast.temperatureC >= 32)
  const rainingNow = input.isRaining === true
  const urgentDry = moisture <= minPct - 8
  const limited = Number.isFinite(availableTankL) && availableTankL < Math.min(needL, 20) && belowMin && !active

  const finish = (
    action: ZoneDecision['action'],
    status: IrrigationAdviceStatus,
    reason: string,
    delayedForRain = false,
  ): ZoneDecision => ({
    action,
    status,
    reason,
    estimatedNeedL: Math.round(needL),
    estimatedDurationMin: Math.round(durationMin),
    nextCheckHours: nextCheckHours(status, soil.drainage, delayedForRain),
    triggerPct: minPct,
    stopPct: maxPct,
    kc,
    weatherApplied,
  })

  if (tankLevelPct <= criticalThresholdPct) {
    return active
      ? finish('stop', 'irrigation-limited-by-water', `Tank level at or below critical threshold (${criticalThresholdPct}%)`)
      : finish(
          'hold',
          'irrigation-limited-by-water',
          `Tank level at or below critical threshold (${criticalThresholdPct}%); irrigation withheld`,
        )
  }

  if (limited) {
    return finish(
      'hold',
      'irrigation-limited-by-water',
      `Soil is dry for ${zone.crop.name} on ${soil.name}, but the main tank only has ${Math.round(availableTankL)} L stored. Shortage/conservation rules apply — watering is not started.`,
    )
  }

  if (active) {
    if (atOrAboveMax) {
      return finish('stop', 'no-irrigation-needed', `Soil moisture reached the wet-enough level (${maxPct}%) for this crop, soil, and growth stage.`)
    }
    return finish(
      'hold',
      moisture <= minPct ? 'irrigation-urgent' : 'irrigation-recommended',
      `Continuing watering until the wet-enough level (${maxPct}%) for ${zone.crop.name} on ${soil.name}.`,
    )
  }

  if (belowMin) {
    if ((rainSoon || rainingNow || recentRain) && !urgentDry) {
      const rainBit = rainingNow
        ? 'Rain is falling on the farm now'
        : rainSoon
          ? `About ${Math.round(forecast!.expectedRainfallMm)} mm of rain is expected soon (${Math.round(forecast!.precipitationProbabilityPct)}% chance)`
          : `About ${Math.round(forecast!.recentRainfallMm ?? 0)} mm of rain was reported recently`
      return finish(
        'hold',
        'monitor',
        `${rainBit}, and ${zone.crop.name} on ${soil.name} can still wait (soil ${Math.round(moisture)}%, start line ${minPct}%). Watering is delayed.`,
        true,
      )
    }

    const hotBit = hotDry ? ' Hot, dry weather is expected, so crop demand is treated as higher.' : ''
    const tankBit =
      Number.isFinite(availableTankL) && availableTankL < needL
        ? ` The main tank has ${Math.round(availableTankL)} L; a full refill is about ${Math.round(needL)} L, so this run can only apply what is stored.`
        : ''
    const status: IrrigationAdviceStatus =
      Number.isFinite(availableTankL) && availableTankL < needL
        ? 'irrigation-limited-by-water'
        : urgentDry
          ? 'irrigation-urgent'
          : 'irrigation-recommended'
    return finish(
      'start',
      status,
      `Soil moisture is ${Math.round(moisture)}%, at or below the ${minPct}% start line for ${zone.crop.name} on ${soil.name} at this growth stage (Kc ${kc.toFixed(2)}).${hotBit}${tankBit}`,
    )
  }

  const nearMin = moisture <= minPct + 6
  if (nearMin && hotDry) {
    return finish(
      'hold',
      'monitor',
      `Soil moisture is ${Math.round(moisture)}%, close to the ${minPct}% start line for ${zone.crop.name} on ${soil.name}, and hot, dry weather is expected. Check again soon.`,
    )
  }

  if (nearMin) {
    return finish(
      'hold',
      'monitor',
      `Soil moisture is ${Math.round(moisture)}%, still above the ${minPct}% start line for ${zone.crop.name} on ${soil.name}. No watering yet.`,
    )
  }

  return finish(
    'hold',
    'no-irrigation-needed',
    `Soil moisture is ${Math.round(moisture)}%, within the acceptable range for ${zone.crop.name} on ${soil.name} (${minPct}–${maxPct}%).`,
  )
}
