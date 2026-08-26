import type { IrrigationZone, PlanningSnapshot, SystemSnapshot, WaterSnapshot } from '@aquaflow/shared'
import { getTankConfig } from '../config/farmSettings.js'
import { getWeatherAdjustmentSafely } from '../forecast/weatherProvider.js'
import {
  emptyRollingWindow,
  estimateSevenDayAverageL,
  observedDaysInWindow,
  predictShortage,
} from '../forecast/shortagePrediction.js'
import { deviceProvider, simulatedProvider } from '../providers/index.js'
import { ACTIVE_FLOW_INPUT_SOURCE } from '../providers/flowInputSource.js'
import { buildWaterSnapshot } from '../water/waterAccounting.js'

export interface FarmState {
  water: WaterSnapshot
  zones: IrrigationZone[]
  system: SystemSnapshot
  planning: PlanningSnapshot
}

/**
 * Reads the same live farm numbers the dashboard already uses.
 * No new water math — planning still goes through `predictShortage`.
 */
export async function loadFarmState(): Promise<FarmState> {
  const [tank, sources, zones, rain, pump, system] = await Promise.all([
    deviceProvider.getTankLevel(),
    deviceProvider.getSources(),
    deviceProvider.getZones(),
    deviceProvider.getRainStatus(),
    deviceProvider.getPumpStatus(),
    deviceProvider.getSystemStatus(),
  ])

  const rates = simulatedProvider?.getLastTickRatesLPerMin() ?? { waterInLPerMin: 0, waterUsedLPerMin: 0 }
  const totals = simulatedProvider?.getCumulativeTotalsL() ?? { inflowL: 0, usedL: 0 }

  const water = buildWaterSnapshot({
    tank,
    tankConfig: getTankConfig(),
    sources,
    waterInLPerMin: rates.waterInLPerMin,
    waterUsedLPerMin: rates.waterUsedLPerMin,
    inflowSinceStartL: totals.inflowL,
    usedSinceStartL: totals.usedL,
    flowInputSource: ACTIVE_FLOW_INPUT_SOURCE,
  })

  const window = simulatedProvider?.getRollingConsumptionWindow() ?? emptyRollingWindow()
  const dailyConsumptionL = estimateSevenDayAverageL(window)
  const weatherAdjustment = await getWeatherAdjustmentSafely()
  const tankConfig = getTankConfig()
  const planning = predictShortage({
    availableTankL: tank.levelL.value,
    dailyConsumptionL,
    tankCapacityL: tankConfig.capacityL,
    lowThresholdPct: tankConfig.lowThresholdPct,
    criticalThresholdPct: tankConfig.criticalThresholdPct,
    observedDays: observedDaysInWindow(window),
    weatherAdjustment,
  })

  return {
    water,
    zones,
    system: { rain, pump, system },
    planning,
  }
}
