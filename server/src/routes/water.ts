import { Router } from 'express'
import { getTankConfig } from '../config/farmSettings.js'
import { deviceProvider, simulatedProvider } from '../providers/index.js'
import { ACTIVE_FLOW_INPUT_SOURCE } from '../providers/flowInputSource.js'
import { buildWaterSnapshot } from '../water/waterAccounting.js'

export const waterRouter = Router()

waterRouter.get('/', async (_req, res, next) => {
  try {
    const [tank, sources] = await Promise.all([deviceProvider.getTankLevel(), deviceProvider.getSources()])
    const rates = simulatedProvider?.getLastTickRatesLPerMin() ?? { waterInLPerMin: 0, waterUsedLPerMin: 0 }
    const totals = simulatedProvider?.getCumulativeTotalsL() ?? { inflowL: 0, usedL: 0 }

    const snapshot = buildWaterSnapshot({
      tank,
      tankConfig: getTankConfig(),
      sources,
      waterInLPerMin: rates.waterInLPerMin,
      waterUsedLPerMin: rates.waterUsedLPerMin,
      inflowSinceStartL: totals.inflowL,
      usedSinceStartL: totals.usedL,
      flowInputSource: ACTIVE_FLOW_INPUT_SOURCE,
    })

    res.json(snapshot)
  } catch (error) {
    next(error)
  }
})
