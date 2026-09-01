import type { IrrigationActionResult, IrrigationZone, OperationMode } from '@aquaflow/shared'
import { getTankConfig } from '../config/farmSettings.js'
import { historyLog, zoneToHistoryInput } from '../history/historyLog.js'
import { deviceProvider, getAccountingProvider } from '../providers/index.js'

/**
 * Minimum time a zone must stay in its current state before it can be
 * turned back ON. Stopping is never debounced — an emergency/manual stop
 * must always be allowed immediately. This is the "system is mid-transition
 * (debounce)" safety interlock from the plan, layered on top of
 * `irrigationEngine`'s hysteresis (which already prevents most rapid
 * toggling by using a wide min/max band).
 */
const MIN_STATE_HOLD_MS = 15_000

/**
 * A reading older than this is treated as stale and blocks any action that
 * depends on it. `SimulatedDeviceProvider` always returns a fresh
 * timestamp, so this can never actually fire under simulation — it exists
 * so the interlock is real, tested, and ready for a real sensor (which can
 * genuinely time out) without needing any change when that happens.
 */
const MAX_READING_AGE_MS = 30_000

const zoneLastChangedAt = new Map<string, number>()

function isReadingStale(asOf: string): boolean {
  return Date.now() - new Date(asOf).getTime() > MAX_READING_AGE_MS
}

function isValidPercent(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 100
}

async function getTankLevelPct(): Promise<{ pct: number; stale: boolean }> {
  const tank = await deviceProvider.getTankLevel()
  return {
    pct: (tank.levelL.value / getTankConfig().capacityL) * 100,
    stale: isReadingStale(tank.levelL.asOf),
  }
}

async function findZone(zoneId: string): Promise<IrrigationZone | undefined> {
  const zones = await deviceProvider.getZones()
  return zones.find((z) => z.id === zoneId)
}

/** Pump follows zones automatically — only while in Auto mode. Manual mode leaves the pump exactly where the farmer set it. */
async function syncPumpToZones(): Promise<void> {
  const [zones, pump] = await Promise.all([deviceProvider.getZones(), deviceProvider.getPumpStatus()])
  const anyActive = zones.some((z) => z.state.active)
  if (pump.isOn.value !== anyActive) {
    await deviceProvider.setPumpState(anyActive)
  }
}

/**
 * The only module allowed to call `deviceProvider.setPumpState()` /
 * `setZoneValve()`. Every caller — the manual "Water now"/"Stop" buttons,
 * the automatic hysteresis loop, and the AquaFlow Assistant —
 * goes through here and is subject to the exact same safety interlocks.
 */
export const safetyController = {
  async setZoneActive(
    zoneId: string,
    active: boolean,
    trigger: 'auto' | 'manual',
  ): Promise<IrrigationActionResult> {
    const zone = await findZone(zoneId)
    if (!zone) return { ok: false, reason: `Unknown zone: ${zoneId}` }

    if (!isValidPercent(zone.state.soilMoisturePct.value)) {
      return { ok: false, reason: 'Soil moisture reading is invalid; irrigation blocked for safety', zone }
    }
    if (isReadingStale(zone.state.soilMoisturePct.asOf)) {
      return { ok: false, reason: 'Soil moisture reading is stale; irrigation blocked for safety', zone }
    }

    if (zone.state.active === active) {
      const reason = active ? 'Zone is already irrigating' : 'Zone is already stopped'
      return { ok: true, reason, zone }
    }

    if (active) {
      const { pct: tankPct, stale: tankStale } = await getTankLevelPct()
      if (tankStale) {
        return { ok: false, reason: 'Tank level reading is stale; irrigation blocked for safety', zone }
      }
      if (tankPct <= getTankConfig().criticalThresholdPct) {
        return {
          ok: false,
          reason: `Tank level at or below critical threshold (${getTankConfig().criticalThresholdPct}%); irrigation blocked`,
          zone,
        }
      }

      const lastChangedAt = zoneLastChangedAt.get(zoneId)
      if (lastChangedAt !== undefined && Date.now() - lastChangedAt < MIN_STATE_HOLD_MS) {
        return {
          ok: false,
          reason: 'Zone changed state too recently; waiting briefly to avoid rapid on/off cycling',
          zone,
        }
      }
    }

    await deviceProvider.setZoneValve(zoneId, active)
    zoneLastChangedAt.set(zoneId, Date.now())

    const mode = await deviceProvider.getOperationMode()
    if (mode === 'auto') await syncPumpToZones()

    const zones = await deviceProvider.getZones()
    const updatedZone = zones.find((z) => z.id === zoneId)

    const reason =
      trigger === 'manual'
        ? active
          ? 'Manual start'
          : 'Manual stop'
        : active
          ? 'Automatic start — soil moisture at or below target minimum'
          : 'Automatic stop — soil moisture reached target maximum'

    if (updatedZone) {
      const usedSinceStartL = getAccountingProvider()?.getCumulativeUsedByZoneL(zoneId) ?? 0
      const tank = await deviceProvider.getTankLevel()
      historyLog.recordIrrigationEvent({
        zone: zoneToHistoryInput(updatedZone, usedSinceStartL),
        wateringAction: active ? 'started' : 'stopped',
        tankLevelL: tank.levelL.value,
      })
    }

    return { ok: true, reason, zone: updatedZone }
  },

  async setPumpState(isOn: boolean): Promise<IrrigationActionResult> {
    const mode = await deviceProvider.getOperationMode()
    if (mode !== 'manual') {
      return { ok: false, reason: 'Switch to Manual mode to control the pump directly' }
    }

    if (isOn) {
      const { pct, stale } = await getTankLevelPct()
      if (stale) return { ok: false, reason: 'Tank level reading is stale; pump start blocked for safety' }
      if (pct <= getTankConfig().criticalThresholdPct) {
        return {
          ok: false,
          reason: `Tank level at or below critical threshold (${getTankConfig().criticalThresholdPct}%); pump start blocked`,
        }
      }
    }

    await deviceProvider.setPumpState(isOn)
    return { ok: true, reason: isOn ? 'Pump turned on manually' : 'Pump turned off manually' }
  },

  async setOperationMode(mode: OperationMode): Promise<IrrigationActionResult> {
    await deviceProvider.setOperationMode(mode)
    return { ok: true, reason: mode === 'auto' ? 'Switched to automatic control' : 'Switched to manual control' }
  },

  /** Exposed so the auto-irrigation loop can keep the pump in sync after its own zone decisions. */
  syncPumpToZones,
}
