import { describe, expect, it } from 'vitest'
import { getWeatherAdjustmentSafely, MockWeatherProvider, type WeatherForecast, type WeatherProvider } from './weatherProvider.js'
import type { DeviceProvider } from '../providers/deviceProvider.js'
import type { RainStatusReading } from '@aquaflow/shared'

function fakeDeviceProviderWithRain(isRaining: boolean): DeviceProvider {
  const rain: RainStatusReading = { isRaining: { value: isRaining, tag: 'simulated', asOf: new Date().toISOString() } }
  return {
    getTankLevel: async () => {
      throw new Error('not used in this test')
    },
    getSources: async () => [],
    getZones: async () => [],
    getZoneConfig: async () => undefined,
    getRainStatus: async () => rain,
    getPumpStatus: async () => ({ isOn: { value: false, tag: 'simulated', asOf: new Date().toISOString() } }),
    getOperationMode: async () => 'auto',
    getSystemStatus: async () => ({ phase: 'waiting', operationMode: 'auto' }),
    setPumpState: async () => {},
    setZoneValve: async () => {},
    setOperationMode: async () => {},
  }
}

class ThrowingWeatherProvider implements WeatherProvider {
  async getForecast(): Promise<WeatherForecast | null> {
    throw new Error('weather service unreachable')
  }
}

class NullWeatherProvider implements WeatherProvider {
  async getForecast(): Promise<WeatherForecast | null> {
    return null
  }
}

class WorkingWeatherProvider implements WeatherProvider {
  constructor(private readonly rainfallMm: number) {}
  async getForecast(): Promise<WeatherForecast | null> {
    return { condition: this.rainfallMm > 0 ? 'rain' : 'clear', expectedRainfallMm: this.rainfallMm, asOf: new Date().toISOString() }
  }
}

describe('MockWeatherProvider', () => {
  it('derives a "clear" forecast from the existing simulated rain sensor when not raining', async () => {
    const provider = new MockWeatherProvider(fakeDeviceProviderWithRain(false))
    const forecast = await provider.getForecast()
    expect(forecast?.condition).toBe('clear')
    expect(forecast?.expectedRainfallMm).toBe(0)
  })

  it('derives a "rain" forecast from the existing simulated rain sensor when raining', async () => {
    const provider = new MockWeatherProvider(fakeDeviceProviderWithRain(true))
    const forecast = await provider.getForecast()
    expect(forecast?.condition).toBe('rain')
    expect(forecast?.expectedRainfallMm).toBeGreaterThan(0)
  })
})

describe('getWeatherAdjustmentSafely', () => {
  it('never throws when the underlying provider throws — resolves to null instead', async () => {
    await expect(getWeatherAdjustmentSafely(new ThrowingWeatherProvider())).resolves.toBeNull()
  })

  it('resolves to null when the underlying provider resolves to null (forecast unavailable)', async () => {
    await expect(getWeatherAdjustmentSafely(new NullWeatherProvider())).resolves.toBeNull()
  })

  it('resolves to a demand adjustment with multiplier 1 when no rain is expected', async () => {
    const adjustment = await getWeatherAdjustmentSafely(new WorkingWeatherProvider(0))
    expect(adjustment).toEqual({ demandMultiplier: 1 })
  })

  it('resolves to a demand adjustment with a reduced multiplier when rain is expected', async () => {
    const adjustment = await getWeatherAdjustmentSafely(new WorkingWeatherProvider(4))
    expect(adjustment?.demandMultiplier).toBeLessThan(1)
    expect(adjustment?.demandMultiplier).toBeGreaterThan(0)
  })
})
