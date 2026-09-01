import { USE_SIMULATED } from '../env.js'
import type { DeviceProvider } from './deviceProvider.js'
import { ESP32DeviceProvider } from './esp32DeviceProvider.js'
import { SimulatedDeviceProvider } from './simulatedDeviceProvider.js'

/**
 * The one place that decides which `DeviceProvider` is active. Everything
 * else imports `deviceProvider` from here and never constructs a provider
 * directly — swapping simulated for real hardware later is a one-line
 * change confined to this file.
 */
export const deviceProvider: DeviceProvider = USE_SIMULATED
  ? new SimulatedDeviceProvider()
  : new ESP32DeviceProvider()

/**
 * Only the simulated provider needs ticking; a real ESP32 provider polls
 * hardware instead. Exposed separately so `simulationEngine` doesn't need
 * to know which provider is active.
 */
export const simulatedProvider =
  deviceProvider instanceof SimulatedDeviceProvider ? deviceProvider : null

export const esp32Provider = deviceProvider instanceof ESP32DeviceProvider ? deviceProvider : null

export function getAccountingProvider(): SimulatedDeviceProvider | ESP32DeviceProvider | null {
  return simulatedProvider ?? esp32Provider
}
