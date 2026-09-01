import type { HardwarePinMap } from '@aquaflow/shared'

/**
 * Exact GPIOs for hardware that is physically connected today.
 * Do not invent pin numbers for devices that are not wired.
 */
export const CONNECTED_GPIO = {
  ULTRASONIC_TRIG: 5,
  ULTRASONIC_ECHO: 18,
  SOIL_ADC_ZONE_A: 34,
  PUMP_RELAY: 26,
} as const

/**
 * Future devices. Null means "not assigned — do not read or drive this pin."
 * Fill these in only after a real wire exists.
 */
export const UNASSIGNED_GPIO = {
  RAIN_SENSOR_PIN: null as number | null,
  FLOW_IN_PIN: null as number | null,
  FLOW_OUT_PIN: null as number | null,
  ZONE_A_VALVE_PIN: null as number | null,
  ZONE_B_VALVE_PIN: null as number | null,
  SECOND_SOIL_PIN: null as number | null,
}

export function hardwarePinMap(): HardwarePinMap {
  return {
    ultrasonicTrig: CONNECTED_GPIO.ULTRASONIC_TRIG,
    ultrasonicEcho: CONNECTED_GPIO.ULTRASONIC_ECHO,
    soilAdcZoneA: CONNECTED_GPIO.SOIL_ADC_ZONE_A,
    pumpRelay: CONNECTED_GPIO.PUMP_RELAY,
    rainSensor: UNASSIGNED_GPIO.RAIN_SENSOR_PIN,
    flowIn: UNASSIGNED_GPIO.FLOW_IN_PIN,
    flowOut: UNASSIGNED_GPIO.FLOW_OUT_PIN,
    zoneAValve: UNASSIGNED_GPIO.ZONE_A_VALVE_PIN,
    zoneBValve: UNASSIGNED_GPIO.ZONE_B_VALVE_PIN,
    secondSoil: UNASSIGNED_GPIO.SECOND_SOIL_PIN,
  }
}

export function isPinAssigned(pin: number | null | undefined): pin is number {
  return typeof pin === 'number' && Number.isInteger(pin) && pin >= 0
}
