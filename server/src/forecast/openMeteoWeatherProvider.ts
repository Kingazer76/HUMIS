import type { FarmLocation } from '@aquaflow/shared'
import { getFarmLocation } from '../config/farmSettings.js'
import { mapOpenMeteoResponse, type OpenMeteoForecastResponse } from './mapOpenMeteo.js'
import type { WeatherForecast, WeatherProvider } from './weatherProvider.js'

const OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'
const CACHE_MS = 15 * 60 * 1000
const FETCH_TIMEOUT_MS = 4000

const CURRENT_FIELDS = [
  'temperature_2m',
  'relative_humidity_2m',
  'precipitation',
  'precipitation_probability',
  'weather_code',
  'rain',
].join(',')

const DAILY_FIELDS = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
  'precipitation_sum',
  'precipitation_probability_max',
  'rain_sum',
].join(',')

export function buildOpenMeteoForecastUrl(location: FarmLocation): string {
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    current: CURRENT_FIELDS,
    daily: DAILY_FIELDS,
    forecast_days: '7',
    timezone: 'auto',
  })
  return `${OPEN_METEO_FORECAST_URL}?${params.toString()}`
}

interface CacheEntry {
  key: string
  forecast: WeatherForecast
  at: number
}

/**
 * Live Open-Meteo forecast. Reads the farm's configured coordinates at
 * request time. No API key. Failures resolve to `null` (or the last good
 * cached forecast) so planning never depends on the network.
 */
export class OpenMeteoWeatherProvider implements WeatherProvider {
  private cache: CacheEntry | undefined

  constructor(
    private readonly readLocation: () => FarmLocation = getFarmLocation,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  clearCache(): void {
    this.cache = undefined
  }

  async getForecast(): Promise<WeatherForecast | null> {
    const location = this.readLocation()
    const key = `${location.latitude},${location.longitude}`
    const cached = this.cache
    if (cached && cached.key === key && Date.now() - cached.at < CACHE_MS) {
      return cached.forecast
    }

    const url = buildOpenMeteoForecastUrl(location)
    try {
      const res = await this.fetchImpl(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
      if (!res.ok) return cached?.key === key ? cached.forecast : null
      const body = (await res.json()) as OpenMeteoForecastResponse
      const forecast = mapOpenMeteoResponse(body, location)
      if (!forecast) return cached?.key === key ? cached.forecast : null
      this.cache = { key, forecast, at: Date.now() }
      return forecast
    } catch {
      return cached?.key === key ? cached.forecast : null
    }
  }
}

export const openMeteoWeatherProvider = new OpenMeteoWeatherProvider()
