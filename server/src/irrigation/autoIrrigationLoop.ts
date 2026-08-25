import { getTankConfig } from '../config/farmSettings.js'
import { AUTO_IRRIGATION_INTERVAL_MS } from '../env.js'
import { deviceProvider } from '../providers/index.js'
import { decideZoneIrrigation } from './irrigationEngine.js'
import { safetyController } from './safetyController.js'

let timer: NodeJS.Timeout | null = null

/**
 * Runs one automatic irrigation decision pass across every zone. Does
 * nothing while in Manual mode — Manual suspends automatic decisions
 * entirely, matching V1's "Switch to Manual mode to control the pump"
 * framing. Deliberately provider-agnostic (reads/writes only through
 * `DeviceProvider` + `safetyController`), so this same loop will run
 * unchanged against a real `ESP32DeviceProvider` later.
 */
export async function runAutoIrrigationCycle(): Promise<void> {
  const mode = await deviceProvider.getOperationMode()
  if (mode !== 'auto') return

  const [tank, zones] = await Promise.all([deviceProvider.getTankLevel(), deviceProvider.getZones()])
  const tankConfig = getTankConfig()
  const tankLevelPct = (tank.levelL.value / tankConfig.capacityL) * 100

  for (const zone of zones) {
    const decision = decideZoneIrrigation({
      zone,
      tankLevelPct,
      criticalThresholdPct: tankConfig.criticalThresholdPct,
    })
    if (decision.action === 'start' && !zone.state.active) {
      await safetyController.setZoneActive(zone.id, true, 'auto')
    } else if (decision.action === 'stop' && zone.state.active) {
      await safetyController.setZoneActive(zone.id, false, 'auto')
    }
  }
}

export function startAutoIrrigationLoop(): void {
  if (timer) return
  timer = setInterval(() => {
    runAutoIrrigationCycle().catch((error: unknown) => {
      // eslint-disable-next-line no-console
      console.error('Auto irrigation cycle failed:', error)
    })
  }, AUTO_IRRIGATION_INTERVAL_MS)
}

export function stopAutoIrrigationLoop(): void {
  if (timer) clearInterval(timer)
  timer = null
}
