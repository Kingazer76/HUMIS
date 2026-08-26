import type { Tagged, WeatherForecastSnapshot } from '@aquaflow/shared'
import type { WeatherForecast } from './weatherProvider.js'

function tagged(value: number, asOf: string): Tagged<number> {
  return { value, tag: 'forecast', asOf }
}

const UNAVAILABLE: WeatherForecastSnapshot = {
  available: false,
  reason:
    "Can't load the weather forecast right now. Days remaining still uses stored water and recent watering.",
}

/**
 * Maps a provider forecast into the Planning API shape. All numbers are
 * tagged `forecast` so the UI can tell them apart from simulated sensors.
 */
export function toWeatherSnapshot(forecast: WeatherForecast | null): WeatherForecastSnapshot {
  if (!forecast) return UNAVAILABLE

  const asOf = forecast.asOf
  return {
    available: true,
    asOf,
    location: forecast.location,
    source: forecast.source,
    condition: forecast.condition,
    temperatureC: forecast.temperatureC !== undefined ? tagged(forecast.temperatureC, asOf) : undefined,
    humidityPct: forecast.humidityPct !== undefined ? tagged(forecast.humidityPct, asOf) : undefined,
    precipitationMm:
      forecast.precipitationMm !== undefined ? tagged(forecast.precipitationMm, asOf) : undefined,
    precipitationProbabilityPct:
      forecast.precipitationProbabilityPct !== undefined
        ? tagged(forecast.precipitationProbabilityPct, asOf)
        : undefined,
    expectedRainfallMm: tagged(forecast.expectedRainfallMm, asOf),
    days: (forecast.days ?? []).map((day) => ({
      date: day.date,
      condition: day.condition,
      temperatureMaxC: tagged(day.temperatureMaxC, asOf),
      temperatureMinC: tagged(day.temperatureMinC, asOf),
      precipitationMm: tagged(day.precipitationMm, asOf),
      precipitationProbabilityPct: tagged(day.precipitationProbabilityPct, asOf),
    })),
  }
}
