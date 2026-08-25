import { Router } from 'express'
import { TANK_CONFIG } from '../config/seedData.js'
import { getWeatherAdjustmentSafely } from '../forecast/weatherProvider.js'
import {
  emptyRollingWindow,
  estimateSevenDayAverageL,
  observedDaysInWindow,
  predictShortage,
} from '../forecast/shortagePrediction.js'
import { deviceProvider, simulatedProvider } from '../providers/index.js'

export const planningRouter = Router()

planningRouter.get('/', async (_req, res, next) => {
  try {
    const tank = await deviceProvider.getTankLevel()
    const window = simulatedProvider?.getRollingConsumptionWindow() ?? emptyRollingWindow()
    const dailyConsumptionL = estimateSevenDayAverageL(window)

    // Never lets a weather failure block planning — see getWeatherAdjustmentSafely.
    const weatherAdjustment = await getWeatherAdjustmentSafely()

    const prediction = predictShortage({
      availableTankL: tank.levelL.value,
      dailyConsumptionL,
      tankCapacityL: TANK_CONFIG.capacityL,
      lowThresholdPct: TANK_CONFIG.lowThresholdPct,
      criticalThresholdPct: TANK_CONFIG.criticalThresholdPct,
      observedDays: observedDaysInWindow(window),
      weatherAdjustment,
    })

    res.json(prediction)
  } catch (error) {
    next(error)
  }
})
