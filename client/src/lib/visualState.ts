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
 * a forecast actually says so — this app's mock weather is rain or clear,
 * so clear maps to normal. Never invents a hot-dry state from tank or soil.
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
  if (state === 'irrigating') return 'Water is going onto this field.'
  return 'Moisture is in a good range for this crop.'
}

export function tankVisualHeadline(state: TankVisualState): string {
  if (state === 'critical') return 'Tank is too empty'
  if (state === 'low') return 'Tank is getting low'
  return 'Tank has plenty of water'
}

export function tankVisualDetail(state: TankVisualState): string {
  if (state === 'critical') return 'New watering will not start until the tank is refilled.'
  if (state === 'low') return 'Watch watering carefully so the tank is not emptied.'
  return 'There is enough stored water for normal watering.'
}

export function weatherVisualHeadline(state: WeatherVisualState): string {
  if (state === 'rain') return 'Rain'
  if (state === 'hot-dry') return 'Hot and dry'
  return 'No rain'
}

export function weatherVisualDetail(state: WeatherVisualState): string {
  if (state === 'rain') return 'Rain is being counted. Watering still follows the tank and soil.'
  if (state === 'hot-dry') return 'Dry weather — fields may need water sooner.'
  return 'No rain right now. Watering still follows the tank and soil.'
}

export function irrigationVisualHeadline(state: IrrigationVisualState): string {
  if (state === 'running') return 'Watering'
  if (state === 'needs-attention') return 'Needs water'
  return 'Doing fine'
}

export function irrigationVisualDetail(state: IrrigationVisualState): string {
  if (state === 'running') return 'Water is flowing to this field.'
  if (state === 'needs-attention') return 'Soil is at the dry target. Watering can start if the tank allows it.'
  return 'This field does not need water right now.'
}

export function shortageVisualHeadline(tier: ShortageTier): string {
  if (tier === 'critical') return 'Water is critically low'
  if (tier === 'high') return 'Water may run short soon'
  if (tier === 'moderate') return 'Water is getting low'
  return 'Water supply looks fine'
}
