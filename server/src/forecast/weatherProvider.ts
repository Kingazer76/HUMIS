import type { DeviceProvider } from '../providers/deviceProvider.js'
import { deviceProvider } from '../providers/index.js'

export type WeatherCondition = 'clear' | 'rain'

export interface WeatherForecast {
  condition: WeatherCondition
  expectedRainfallMm: number
  asOf: string
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
 * `getWeatherAdjustmentSafely` below rather than calling `getForecast`
 * directly, so a failure here can never propagate into a crash.
 */
export interface WeatherProvider {
  getForecast(): Promise<WeatherForecast | null>
}

/**
 * Derives a lightweight forecast from the existing simulated rain sensor
 * (`DeviceProvider.getRainStatus`) instead of building a second, parallel
 * weather-simulation system. "Weather" stays its own interface — swappable
 * for a real forecast API later — while reusing the one simulated
 * environmental signal this codebase already has.
 */
export class MockWeatherProvider implements WeatherProvider {
  constructor(private readonly provider: DeviceProvider = deviceProvider) {}

  async getForecast(): Promise<WeatherForecast | null> {
    const rain = await this.provider.getRainStatus()
    return {
      condition: rain.isRaining.value ? 'rain' : 'clear',
      expectedRainfallMm: rain.isRaining.value ? 4 : 0,
      asOf: new Date().toISOString(),
    }
  }
}

export const weatherProvider: WeatherProvider = new MockWeatherProvider()

function toDemandAdjustment(forecast: WeatherForecast): WeatherAdjustment {
  // Expected rain modestly reduces projected irrigation demand. This is a
  // simple, documented multiplier for the planning forecast only — it does
  // not duplicate or replace `irrigationEngine`'s own rain handling, which
  // governs actual zone actuation separately.
  return { demandMultiplier: forecast.expectedRainfallMm > 0 ? 0.85 : 1 }
}

/**
 * The only way `shortagePrediction` (or anything else) should consult
 * weather. Never throws: a thrown error, a `null` forecast, or any
 * unexpected failure all resolve to `null`, meaning "proceed without a
 * weather adjustment" — never "block the calculation."
 */
export async function getWeatherAdjustmentSafely(
  provider: WeatherProvider = weatherProvider,
): Promise<WeatherAdjustment | null> {
  try {
    const forecast = await provider.getForecast()
    if (!forecast) return null
    return toDemandAdjustment(forecast)
  } catch {
    return null
  }
}
