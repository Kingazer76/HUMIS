import { describe, expect, it, vi } from 'vitest'
import { OpenMeteoWeatherProvider, buildOpenMeteoForecastUrl } from './openMeteoWeatherProvider.js'

const ACCRA = { latitude: 5.55, longitude: -0.2, label: 'Accra, Ghana' }

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: async () => body,
  } as Response
}

describe('OpenMeteoWeatherProvider', () => {
  it('puts the farm location into the Open-Meteo URL instead of a baked-in city', () => {
    const url = buildOpenMeteoForecastUrl(ACCRA)
    expect(url.startsWith('https://api.open-meteo.com/v1/forecast?')).toBe(true)
    expect(url).toContain('latitude=5.55')
    expect(url).toContain('longitude=-0.2')
    expect(url).not.toContain('6.6885')
  })

  it('requests the configured farm coordinates and maps the response', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      expect(url).toContain('latitude=5.55')
      expect(url).toContain('longitude=-0.2')
      return jsonResponse({
        current: {
          time: '2026-08-26T11:00',
          temperature_2m: 30,
          relative_humidity_2m: 70,
          precipitation: 0,
          precipitation_probability: 10,
          weather_code: 1,
          rain: 0,
        },
        daily: {
          time: ['2026-08-26'],
          weather_code: [1],
          temperature_2m_max: [31],
          temperature_2m_min: [24],
          precipitation_sum: [0],
          precipitation_probability_max: [10],
          rain_sum: [0],
        },
      })
    })

    const provider = new OpenMeteoWeatherProvider(() => ACCRA, fetchImpl as typeof fetch)
    const forecast = await provider.getForecast()
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(forecast?.source).toBe('open-meteo')
    expect(forecast?.location).toEqual(ACCRA)
    expect(forecast?.temperatureC).toBe(30)
    expect(forecast?.days).toHaveLength(1)
  })

  it('reuses a fresh cache so Planning polls do not refetch every few seconds', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        current: {
          temperature_2m: 28,
          relative_humidity_2m: 65,
          precipitation: 0,
          precipitation_probability: 5,
          weather_code: 0,
        },
      }),
    )
    const provider = new OpenMeteoWeatherProvider(() => ACCRA, fetchImpl as typeof fetch)
    await provider.getForecast()
    await provider.getForecast()
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('returns null when Open-Meteo is unreachable', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('network down')
    })
    const provider = new OpenMeteoWeatherProvider(() => ACCRA, fetchImpl as typeof fetch)
    await expect(provider.getForecast()).resolves.toBeNull()
  })
})
