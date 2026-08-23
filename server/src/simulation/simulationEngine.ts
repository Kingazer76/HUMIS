import { SIM_MINUTES_PER_TICK, SIM_TICK_INTERVAL_MS } from '../env.js'
import { simulatedProvider } from '../providers/index.js'

let timer: NodeJS.Timeout | null = null

/**
 * Starts the tick loop that advances `SimulatedDeviceProvider`'s state.
 * State lives only in that provider's memory for this Express process —
 * it resets on server restart, which is expected for this prototype and
 * is not treated as persistent storage anywhere in this codebase.
 *
 * A no-op when `USE_SIMULATED=false` (a real `ESP32DeviceProvider` polls
 * hardware on its own schedule instead of being ticked like this).
 */
export function startSimulationEngine(): void {
  const provider = simulatedProvider
  if (!provider) return
  if (timer) return
  timer = setInterval(() => {
    provider.tick(SIM_MINUTES_PER_TICK)
  }, SIM_TICK_INTERVAL_MS)
}

export function stopSimulationEngine(): void {
  if (timer) clearInterval(timer)
  timer = null
}
