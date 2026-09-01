import { describe, expect, it } from 'vitest'
import { hardwarePinMap, UNASSIGNED_GPIO } from './gpioPins.js'

describe('GPIO map', () => {
  it('uses the confirmed pins and leaves future devices unassigned', () => {
    const pins = hardwarePinMap()
    expect(pins.ultrasonicTrig).toBe(5)
    expect(pins.ultrasonicEcho).toBe(18)
    expect(pins.soilAdcZoneA).toBe(34)
    expect(pins.pumpRelay).toBe(26)
    expect(pins.rainSensor).toBeNull()
    expect(pins.flowIn).toBeNull()
    expect(pins.flowOut).toBeNull()
    expect(pins.zoneAValve).toBeNull()
    expect(pins.zoneBValve).toBeNull()
    expect(pins.secondSoil).toBeNull()
    expect(UNASSIGNED_GPIO.RAIN_SENSOR_PIN).toBeNull()
    expect(UNASSIGNED_GPIO.FLOW_IN_PIN).toBeNull()
    expect(UNASSIGNED_GPIO.FLOW_OUT_PIN).toBeNull()
    expect(UNASSIGNED_GPIO.ZONE_A_VALVE_PIN).toBeNull()
    expect(UNASSIGNED_GPIO.ZONE_B_VALVE_PIN).toBeNull()
    expect(UNASSIGNED_GPIO.SECOND_SOIL_PIN).toBeNull()
  })
})
