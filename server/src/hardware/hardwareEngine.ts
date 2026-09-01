import { recordHistoryAfterTick } from '../history/recordFromSimulation.js'
import { esp32Provider } from '../providers/index.js'

const HARDWARE_TICK_MS = 5_000
const HARDWARE_TICK_MINUTES = HARDWARE_TICK_MS / 60_000

let timer: NodeJS.Timeout | null = null

/**
 * Keeps Zone B's simulated soil fresh and estimates Water USED from
 * configured rates while the real pump is running. No-op when the
 * practice farm is still the active DeviceProvider.
 */
export function startHardwareEngine(): void {
  const provider = esp32Provider
  if (!provider) return
  if (timer) return
  timer = setInterval(() => {
    provider.accountTick(HARDWARE_TICK_MINUTES)
    recordHistoryAfterTick(provider, HARDWARE_TICK_MINUTES).catch((error: unknown) => {
      // eslint-disable-next-line no-console
      console.error('Hardware history snapshot failed:', error)
    })
  }, HARDWARE_TICK_MS)
}

export function stopHardwareEngine(): void {
  if (timer) clearInterval(timer)
  timer = null
}
