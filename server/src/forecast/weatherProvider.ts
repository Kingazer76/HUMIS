import type { FarmLocation, WeatherCondition } from '@aquaflow/shared'
import type { DeviceProvider } from '../providers/deviceProvider.js'
import { deviceProvider } from '../providers/index.js'
import { openMeteoWeatherProvider } from './openMeteoWeatherProvider.js'

export type { WeatherCondition }

export interface DailyWeatherForecast {
  date: string
  condition: WeatherCondition
  temperatureMaxC: number
  temperatureMinC: number
  precipitationMm: number
  precipitationProbabilityPct: number
}

export interface WeatherForecast {
  condition: WeatherCondition
  expectedRainfallMm: number
  asOf: string
  temperatureC?: number
  humidityPct?: number
  precipitationMm?: number
  precipitationProbabilityPct?: number
  location?: FarmLocation
  source?: string
  days?: DailyWeatherForecast[]
}

export interface WeatherAdjustment {
  /** Multiplier applied to the daily-consumption estimate before projecting days remaining. <1 = rain expected (less irrigation needed), 1 = no adjustment. */
  demandMultiplier: number
}

/**
 * Weather is optional, kept architecturally separate from physical/
 * simulated sensor readings, and must never be required for planning (or
 * irrigation) to function. Any implementation may throw or resolve to
 * `null` to mean "unavailable" — callers must go through
 * `getForecastSafely` / `getWeatherAdjustmentSafely` rather than calling
 * `getForecast` directly, so a failure here can never propagate into a crash.
 *
 * Swap this later by pointing `weatherProvider` at a different class that
 * implements the same interface.
 */
export interface WeatherProvider {
  getForecast(): Promise<WeatherForecast | null>
}

/**
 * Kept for tests and as a drop-in swap. Not used on the live forecast
 * path — that is `OpenMeteoWeatherProvider`. This mock still reads the
 * simulated rain sensor so old tests can prove the fail-safe wrapper.
 */
export class MockWeatherProvider implements WeatherProvider {
  constructor(private readonly provider: DeviceProvider = deviceProvider) {}

  async getForecast(): Promise<WeatherForecast | null> {
    const rain = await this.provider.getRainStatus()
    return {
      condition: rain.isRaining.value ? 'rain' : 'clear',
      expectedRainfallMm: rain.isRaining.value ? 4 : 0,
      asOf: new Date().toISOString(),
      source: 'mock',
    }
  }
}

/** Active forecast path: Open-Meteo, using the farm's configured location. */
export const weatherProvider: WeatherProvider = openMeteoWeatherProvider

export function toDemandAdjustment(forecast: WeatherForecast): WeatherAdjustment {
  // Expected rain modestly reduces projected irrigation demand. This is a
  // simple, documented multiplier for the planning forecast only — it does
  // not duplicate or replace `irrigationEngine`'s own rain handling, which
  // governs actual zone actuation separately.
  return { demandMultiplier: forecast.expectedRainfallMm > 0 ? 0.85 : 1 }
}

/**
 * Never throws: a thrown error, a `null` forecast, or any unexpected
 * failure all resolve to `null`, meaning "proceed without a forecast."
 */
export async function getForecastSafely(
  provider: WeatherProvider = weatherProvider,
): Promise<WeatherForecast | null> {
  try {
    const forecast = await provider.getForecast()
    return forecast ?? null
  } catch {
    return null
  }
}

/**
 * The only way `shortagePrediction` (or anything else) should consult
 * weather for days-remaining math. Never throws.
 */
export async function getWeatherAdjustmentSafely(
  provider: WeatherProvider = weatherProvider,
): Promise<WeatherAdjustment | null> {
  const forecast = await getForecastSafely(provider)
  if (!forecast) return null
  return toDemandAdjustment(forecast)
}
