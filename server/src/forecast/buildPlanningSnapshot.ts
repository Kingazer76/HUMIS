import type { PlanningSnapshot } from '@aquaflow/shared'
import { getTankConfig } from '../config/farmSettings.js'
import { deviceProvider, simulatedProvider } from '../providers/index.js'
import {
  emptyRollingWindow,
  estimateSevenDayAverageL,
  observedDaysInWindow,
  predictShortage,
} from './shortagePrediction.js'
import { toWeatherSnapshot } from './toWeatherSnapshot.js'
import { getForecastSafely, toDemandAdjustment } from './weatherProvider.js'

/**
 * Shared Planning payload for GET /api/planning and the assistant.
 * Fetches the live forecast once, then reuses the existing shortage math.
 */
export async function buildPlanningSnapshot(): Promise<PlanningSnapshot> {
  const tank = await deviceProvider.getTankLevel()
  const window = simulatedProvider?.getRollingConsumptionWindow() ?? emptyRollingWindow()
  const dailyConsumptionL = estimateSevenDayAverageL(window)
  const forecast = await getForecastSafely()
  const weatherAdjustment = forecast ? toDemandAdjustment(forecast) : null
  const tankConfig = getTankConfig()
  const prediction = predictShortage({
    availableTankL: tank.levelL.value,
    dailyConsumptionL,
    tankCapacityL: tankConfig.capacityL,
    lowThresholdPct: tankConfig.lowThresholdPct,
    criticalThresholdPct: tankConfig.criticalThresholdPct,
    observedDays: observedDaysInWindow(window),
    weatherAdjustment,
  })
  return { ...prediction, weather: toWeatherSnapshot(forecast) }
}
