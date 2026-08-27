/**
 * Farmer-facing visual states. These functions only *label* numbers the
 * API already returns. They use the same edges as irrigation start/stop
 * and shortage risk: soil starts watering at or below the dry target,
 * and the tank is critical/low at or below those Settings percentages.
 * No new thresholds live here.
 */

import type { ShortageTier } from '@aquaflow/shared'

export type SoilVisualState = 'dry' | 'healthy' | 'irrigating'
export type TankVisualState = 'high' | 'low' | 'critical'
export type WeatherVisualState = 'rain' | 'hot-dry' | 'normal'
export type IrrigationVisualState = 'running' | 'healthy' | 'needs-attention'

/**
 * Matches `irrigationEngine`: a zone that is already watering shows as
 * irrigating; otherwise soil at or below the dry target is dry, and
 * everything above that is healthy (including wet-enough soil after a stop).
 */
export function deriveSoilVisualState(
  moisturePct: number,
  minPct: number,
  maxPct: number,
  isActive: boolean,
): SoilVisualState {
  void maxPct
  if (isActive) return 'irrigating'
  if (moisturePct <= minPct) return 'dry'
  return 'healthy'
}

/**
 * Matches `shortagePrediction` / `safetyController`: critical wins at or
 * below the stop-watering level, then low at or below the warning level.
 */
export function deriveTankVisualState(
  fillPct: number,
  lowThresholdPct: number,
  criticalThresholdPct: number,
): TankVisualState {
  if (fillPct <= criticalThresholdPct) return 'critical'
  if (fillPct <= lowThresholdPct) return 'low'
  return 'high'
}

/**
 * Rain comes from the existing rain reading. `hot-dry` is only used when
 * a forecast actually says so. Live farm rain (Overview / Irrigation) still
 * uses the rain sensor; Planning uses the Open-Meteo forecast condition.
 */
export function deriveWeatherVisualState(input: {
  isRaining: boolean
  condition?: 'rain' | 'clear' | 'hot-dry'
}): WeatherVisualState {
  if (input.isRaining || input.condition === 'rain') return 'rain'
  if (input.condition === 'hot-dry') return 'hot-dry'
  return 'normal'
}

export function deriveIrrigationVisualState(
  isActive: boolean,
  needsAttention: boolean,
): IrrigationVisualState {
  if (isActive) return 'running'
  if (needsAttention) return 'needs-attention'
  return 'healthy'
}

/** Pass-through so shortage art uses the same tier Planning already computed. */
export function deriveShortageVisualState(tier: ShortageTier): ShortageTier {
  return tier
}

export function soilVisualHeadline(state: SoilVisualState): string {
  if (state === 'dry') return 'Soil is dry'
  if (state === 'irrigating') return 'Watering now'
  return 'Soil looks good'
}

export function soilVisualDetail(state: SoilVisualState): string {
  if (state === 'dry') return 'This field needs water.'
  if (state === 'irrigating') return 'Water is currently flowing to this field.'
  return 'The soil has enough water for this crop.'
}

export function tankVisualHeadline(state: TankVisualState): string {
  if (state === 'critical') return 'Water level is too low'
  if (state === 'low') return 'Water level is low'
  return 'Water level is good'
}

export function tankVisualDetail(state: TankVisualState): string {
  if (state === 'critical') return 'New watering will not start until more water is stored.'
  if (state === 'low') return 'Watch watering so the stored water is not emptied.'
  return 'There is enough stored water for normal watering.'
}

export function weatherVisualHeadline(
  state: WeatherVisualState,
  mode: 'live' | 'forecast' = 'live',
): string {
  if (state === 'rain') return mode === 'forecast' ? 'Rain expected' : 'Rain detected'
  if (state === 'hot-dry') return 'Hot and dry'
  return mode === 'forecast' ? 'No rain expected' : 'No rain'
}

export function weatherVisualDetail(
  state: WeatherVisualState,
  mode: 'live' | 'forecast' = 'live',
): string {
  if (state === 'rain') {
    return mode === 'forecast'
      ? 'Rain is in the forecast. Watering still follows the stored water and the soil.'
      : 'Rain is adding water to the main tank. Extra rain overflows when the tank is full.'
  }
  if (state === 'hot-dry') return 'Dry weather — fields may need water sooner.'
  return mode === 'forecast'
    ? 'No rain is in the forecast. Watering still follows the stored water and the soil.'
    : 'No rain right now. Watering still follows the stored water and the soil.'
}

export function irrigationVisualHeadline(state: IrrigationVisualState): string {
  if (state === 'running') return 'Watering now'
  if (state === 'needs-attention') return 'Needs water'
  return 'Not watering'
}

export function irrigationVisualDetail(state: IrrigationVisualState): string {
  if (state === 'running') return 'Water is currently flowing to this field.'
  if (state === 'needs-attention') return 'Soil is dry. Watering can start if there is enough stored water.'
  return 'This field does not need water right now.'
}

export function shortageVisualHeadline(tier: ShortageTier): string {
  if (tier === 'critical') return 'Water may run out soon'
  if (tier === 'high') return 'Water may run low soon'
  if (tier === 'moderate') return 'Water may run low soon'
  return 'Water looks fine'
}

/** Farmer wording for the live system phase — presentation only. */
export function formatSystemPhase(phase: string): string {
  if (phase === 'irrigating') return 'Watering now'
  if (phase === 'rain-detected') return 'Rain detected'
  if (phase === 'low-water') return 'Water level is low'
  if (phase === 'soil-moisture-sufficient') return 'Soil looks good'
  if (phase === 'waiting') return 'Waiting'
  return phase.replaceAll('-', ' ')
}
