import type { IrrigationZone, TankState } from '@aquaflow/shared'
import { historyLog, zoneToHistoryInput } from '../history/historyLog.js'

export interface HistoryTickProvider {
  getTankLevel(): Promise<TankState>
  getZones(): Promise<IrrigationZone[]>
  getCumulativeUsedByZoneL(zoneId: string): number
}

/**
 * Copies the just-ticked farm into the History log when a periodic
 * snapshot is due. Irrigation start/stop rows are written from
 * `safetyController` instead — this only handles the quiet "how was the
 * field looking?" snapshots.
 */
export async function recordHistoryAfterTick(
  provider: HistoryTickProvider,
  elapsedMinutes: number,
): Promise<void> {
  const [tank, zones] = await Promise.all([provider.getTankLevel(), provider.getZones()])
  historyLog.ingestElapsed(elapsedMinutes, {
    tankLevelL: tank.levelL.value,
    zones: zones.map((zone) => zoneToHistoryInput(zone, provider.getCumulativeUsedByZoneL(zone.id))),
  })
}
