import type { FarmLocation, WeatherCondition } from '@aquaflow/shared'
import type { DailyWeatherForecast, WeatherForecast } from './weatherProvider.js'

/**
 * WMO weather interpretation codes that mean rain, drizzle, storms, or
 * other falling water. Snow is treated as precipitation too so Planning
 * still shows "rain expected" rather than inventing a new picture.
 */
export function isPrecipitationWeatherCode(code: number): boolean {
  return (code >= 51 && code <= 67) || (code >= 71 && code <= 77) || (code >= 80 && code <= 99)
}

export function conditionFromOpenMeteo(input: {
  weatherCode: number
  temperatureC: number
  precipitationMm: number
}): WeatherCondition {
  if (isPrecipitationWeatherCode(input.weatherCode) || input.precipitationMm > 0.2) {
    return 'rain'
  }
  if (input.temperatureC >= 32 && input.precipitationMm <= 0.2) {
    return 'hot-dry'
  }
  return 'clear'
}

interface OpenMeteoCurrent {
  time?: unknown
  temperature_2m?: unknown
  relative_humidity_2m?: unknown
  precipitation?: unknown
  precipitation_probability?: unknown
  weather_code?: unknown
  rain?: unknown
}

interface OpenMeteoDaily {
  time?: unknown
  weather_code?: unknown
  temperature_2m_max?: unknown
  temperature_2m_min?: unknown
  precipitation_sum?: unknown
  precipitation_probability_max?: unknown
  rain_sum?: unknown
}

export interface OpenMeteoForecastResponse {
  current?: OpenMeteoCurrent
  daily?: OpenMeteoDaily
}

function asFinite(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : undefined
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function asNumberArray(value: unknown): number[] {
  return Array.isArray(value) ? value.map((item) => asFinite(item)).filter((n): n is number => n !== undefined) : []
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

/**
 * Turns an Open-Meteo `/v1/forecast` JSON body into AquaFlow's existing
 * weather forecast shape. Returns null when required current fields are
 * missing so callers treat it as "unavailable", never as fake numbers.
 */
export function mapOpenMeteoResponse(
  body: OpenMeteoForecastResponse,
  location: FarmLocation,
  asOf = new Date().toISOString(),
): WeatherForecast | null {
  const current = body.current
  if (!current) return null

  const temperatureC = asFinite(current.temperature_2m)
  const humidityPct = asFinite(current.relative_humidity_2m)
  const precipitationMm = asFinite(current.precipitation) ?? asFinite(current.rain) ?? 0
  const precipitationProbabilityPct = asFinite(current.precipitation_probability) ?? 0
  const weatherCode = asFinite(current.weather_code)
  if (temperatureC === undefined || humidityPct === undefined || weatherCode === undefined) {
    return null
  }

  const daily = mapDaily(body.daily)
  const todayPrecip = daily[0]?.precipitationMm
  const tomorrowPrecip = daily[1]?.precipitationMm
  const expectedRainfallMm =
    todayPrecip !== undefined && todayPrecip > 0
      ? todayPrecip
      : tomorrowPrecip !== undefined && tomorrowPrecip > 0
        ? tomorrowPrecip
        : precipitationMm

  const condition = conditionFromOpenMeteo({
    weatherCode,
    temperatureC,
    precipitationMm: expectedRainfallMm,
  })

  return {
    condition,
    expectedRainfallMm,
    temperatureC,
    humidityPct,
    precipitationMm,
    precipitationProbabilityPct,
    asOf: asString(current.time) ?? asOf,
    location,
    source: 'open-meteo',
    days: daily,
  }
}

function mapDaily(daily: OpenMeteoDaily | undefined): DailyWeatherForecast[] {
  if (!daily) return []
  const dates = asStringArray(daily.time)
  const codes = asNumberArray(daily.weather_code)
  const maxC = asNumberArray(daily.temperature_2m_max)
  const minC = asNumberArray(daily.temperature_2m_min)
  const precip = asNumberArray(daily.precipitation_sum)
  const rain = asNumberArray(daily.rain_sum)
  const chance = asNumberArray(daily.precipitation_probability_max)
  const count = dates.length

  const days: DailyWeatherForecast[] = []
  for (let i = 0; i < count; i += 1) {
    const precipitationMm = precip[i] ?? rain[i] ?? 0
    const temperatureMaxC = maxC[i]
    const temperatureMinC = minC[i]
    if (temperatureMaxC === undefined || temperatureMinC === undefined) continue
    const weatherCode = codes[i] ?? 0
    days.push({
      date: dates[i]!,
      condition: conditionFromOpenMeteo({
        weatherCode,
        temperatureC: temperatureMaxC,
        precipitationMm,
      }),
      temperatureMaxC,
      temperatureMinC,
      precipitationMm,
      precipitationProbabilityPct: chance[i] ?? 0,
    })
  }
  return days
}
