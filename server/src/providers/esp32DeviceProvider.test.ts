import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_HARDWARE_CALIBRATION } from '@aquaflow/shared'
import { resetFarmSettingsForTests } from '../config/farmSettings.js'
import { recordTelemetry, resetHardwareStoreForTests } from '../hardware/hardwareStore.js'
import { ESP32DeviceProvider } from './esp32DeviceProvider.js'

describe('ESP32DeviceProvider', () => {
  let provider: ESP32DeviceProvider

  beforeEach(() => {
    resetFarmSettingsForTests()
    resetHardwareStoreForTests()
    provider = new ESP32DeviceProvider()
  })

  afterEach(() => {
    resetHardwareStoreForTests()
    resetFarmSettingsForTests()
  })

  it('maps GPIO 34 soil onto Zone A as measured, and does not copy it onto Zone B', async () => {
    recordTelemetry({
      tankDistanceCm: 42,
      soilAdc: 1800,
      pumpIsOn: false,
      rainIsWet: null,
      flowInHz: null,
      flowOutHz: null,
      ok: true,
    })

    const zones = await provider.getZones()
    const zoneA = zones.find((z) => z.id === 'zone-a')!
    const zoneB = zones.find((z) => z.id === 'zone-b')!
    const expectedPct = ((3000 - 1800) / (3000 - 1200)) * 100

    expect(zoneA.state.soilMoisturePct.tag).toBe('measured')
    expect(zoneA.state.soilMoisturePct.value).toBeCloseTo(expectedPct, 5)
    expect(zoneB.state.soilMoisturePct.tag).toBe('simulated')
    expect(zoneB.state.soilMoisturePct.value).not.toBe(zoneA.state.soilMoisturePct.value)
    expect(zoneB.state.soilMoisturePct.value).toBeCloseTo(52, 0)
  })

  it('converts ultrasonic distance into tank litres using Settings calibration', async () => {
    recordTelemetry({
      tankDistanceCm: 42,
      soilAdc: 1800,
      pumpIsOn: true,
      rainIsWet: null,
      flowInHz: null,
      flowOutHz: null,
      ok: true,
    })
    const tank = await provider.getTankLevel()
    const expected = ((100 - 42) / (100 - 20)) * 15000
    expect(tank.levelL.tag).toBe('measured')
    expect(tank.levelL.value).toBeCloseTo(expected, 5)
    expect(DEFAULT_HARDWARE_CALIBRATION.tankEmptyDistanceCm).toBe(100)
  })

  it('does not invent rain or flow when those pins are unassigned', async () => {
    recordTelemetry({
      tankDistanceCm: 42,
      soilAdc: 1800,
      pumpIsOn: false,
      rainIsWet: true,
      flowInHz: 12,
      flowOutHz: 8,
      ok: true,
    })
    const rain = await provider.getRainStatus()
    expect(rain.isRaining.value).toBe(false)
    expect(rain.isRaining.tag).toBe('simulated')
  })

  it('keeps valve commands off while no valve GPIOs are assigned', async () => {
    recordTelemetry({
      tankDistanceCm: 42,
      soilAdc: 1800,
      pumpIsOn: false,
      rainIsWet: null,
      flowInHz: null,
      flowOutHz: null,
      ok: true,
    })
    await provider.setZoneValve('zone-a', true)
    const { getHardwareCommand } = await import('../hardware/hardwareStore.js')
    const command = getHardwareCommand()
    expect(command.valveA).toBe(0)
    expect(command.valveB).toBe(0)
    const zones = await provider.getZones()
    expect(zones.find((z) => z.id === 'zone-a')!.state.active).toBe(true)
  })

  it('writes a pump command when the tank reading is valid', async () => {
    recordTelemetry({
      tankDistanceCm: 42,
      soilAdc: 1800,
      pumpIsOn: false,
      rainIsWet: null,
      flowInHz: null,
      flowOutHz: null,
      ok: true,
    })
    await provider.setPumpState(true)
    const { getHardwareCommand } = await import('../hardware/hardwareStore.js')
    expect(getHardwareCommand().pump).toBe(1)
    await provider.setPumpState(false)
    expect(getHardwareCommand().pump).toBe(0)
  })

  it('forces the pump off when ultrasonic is invalid', async () => {
    recordTelemetry({
      tankDistanceCm: null,
      soilAdc: 1800,
      pumpIsOn: true,
      rainIsWet: null,
      flowInHz: null,
      flowOutHz: null,
      ok: true,
    })
    await provider.setPumpState(true)
    const { getHardwareCommand } = await import('../hardware/hardwareStore.js')
    expect(getHardwareCommand().pump).toBe(0)
  })
})
