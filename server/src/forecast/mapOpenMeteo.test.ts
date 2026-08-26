import { describe, expect, it } from 'vitest'
import { conditionFromOpenMeteo, isPrecipitationWeatherCode, mapOpenMeteoResponse } from './mapOpenMeteo.js'

const KUMASI = { latitude: 6.6885, longitude: -1.6244, label: 'Kumasi, Ghana' }

describe('conditionFromOpenMeteo', () => {
  it('maps drizzle and rain codes to rain', () => {
    expect(isPrecipitationWeatherCode(51)).toBe(true)
    expect(conditionFromOpenMeteo({ weatherCode: 51, temperatureC: 27, precipitationMm: 0.1 })).toBe('rain')
    expect(conditionFromOpenMeteo({ weatherCode: 80, temperatureC: 24, precipitationMm: 5 })).toBe('rain')
  })

  it('maps a hot dry day without rain to hot-dry', () => {
    expect(conditionFromOpenMeteo({ weatherCode: 0, temperatureC: 34, precipitationMm: 0 })).toBe('hot-dry')
  })

  it('maps a mild clear day to clear', () => {
    expect(conditionFromOpenMeteo({ weatherCode: 1, temperatureC: 27, precipitationMm: 0 })).toBe('clear')
  })
})

describe('mapOpenMeteoResponse', () => {
  it('maps current and multi-day fields into the existing weather forecast shape', () => {
    const forecast = mapOpenMeteoResponse(
      {
        current: {
          time: '2026-08-26T11:00',
          temperature_2m: 27,
          relative_humidity_2m: 74,
          precipitation: 0.1,
          precipitation_probability: 47,
          weather_code: 51,
          rain: 0,
        },
        daily: {
          time: ['2026-08-26', '2026-08-27'],
          weather_code: [55, 51],
          temperature_2m_max: [29.7, 29],
          temperature_2m_min: [22.6, 22.5],
          precipitation_sum: [3.3, 2.3],
          precipitation_probability_max: [88, 81],
          rain_sum: [2, 1.1],
        },
      },
      KUMASI,
    )

    expect(forecast).not.toBeNull()
    expect(forecast?.source).toBe('open-meteo')
    expect(forecast?.location).toEqual(KUMASI)
    expect(forecast?.condition).toBe('rain')
    expect(forecast?.temperatureC).toBe(27)
    expect(forecast?.humidityPct).toBe(74)
    expect(forecast?.precipitationProbabilityPct).toBe(47)
    expect(forecast?.expectedRainfallMm).toBe(3.3)
    expect(forecast?.days).toHaveLength(2)
    expect(forecast?.days?.[0]?.date).toBe('2026-08-26')
    expect(forecast?.days?.[0]?.precipitationProbabilityPct).toBe(88)
  })

  it('returns null when current weather is missing so planning can proceed without fake numbers', () => {
    expect(mapOpenMeteoResponse({ daily: { time: [] } }, KUMASI)).toBeNull()
  })
})
