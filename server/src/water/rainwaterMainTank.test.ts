import { beforeEach, describe, expect, it } from 'vitest'
import { applyTankSettings, getTankConfig, resetFarmSettingsForTests } from '../config/farmSettings.js'
import { RAINWATER_INFLOW_L_PER_MIN } from '../config/seedData.js'
import { SimulatedDeviceProvider } from '../providers/simulatedDeviceProvider.js'
import { ACTIVE_FLOW_INPUT_SOURCE } from '../providers/flowInputSource.js'
import { buildWaterSnapshot } from './waterAccounting.js'

describe('rainwater feeds the main tank only', () => {
  let provider: SimulatedDeviceProvider

  beforeEach(() => {
    resetFarmSettingsForTests()
    provider = new SimulatedDeviceProvider()
    provider.setSourceStateForTests('well-borehole', { active: false })
    provider.setSourceStateForTests('reservoir-pond', { active: false })
    provider.setSourceStateForTests('manual-supply', { active: false })
  })

  async function snapshot() {
    const [tank, sources] = await Promise.all([provider.getTankLevel(), provider.getSources()])
    const rates = provider.getLastTickRatesLPerMin()
    const totals = provider.getCumulativeTotalsL()
    return buildWaterSnapshot({
      tank,
      tankConfig: getTankConfig(),
      sources,
      waterInLPerMin: rates.waterInLPerMin,
      waterUsedLPerMin: rates.waterUsedLPerMin,
      inflowSinceStartL: totals.inflowL,
      usedSinceStartL: totals.usedL,
      flowInputSource: ACTIVE_FLOW_INPUT_SOURCE,
    })
  }

  it('increases water in and main-tank volume when rain is detected', async () => {
    provider.setTankLevelForTests(9000)
    provider.setRainForTests(true)
    const tick = provider.tick(4)
    expect(tick.rainInL).toBeCloseTo(RAINWATER_INFLOW_L_PER_MIN * 4)
    expect(tick.waterInL).toBe(tick.rainInL)

    const water = await snapshot()
    expect(water.mainTankL.value).toBeCloseTo(9000 + RAINWATER_INFLOW_L_PER_MIN * 4)
    expect(water.waterInLPerMin.value).toBeCloseTo(RAINWATER_INFLOW_L_PER_MIN)
    expect(water.waterInLPerMin.tag).toBe('estimated')
    expect(water.waterInLPerMin.flowInputSource).toBe('configured-rate')
  })

  it('never lets the main tank exceed configured capacity', async () => {
    applyTankSettings({ capacityL: 20, lowThresholdPct: 25, criticalThresholdPct: 15 })
    provider.applyTankCapacity(20)
    provider.setTankLevelForTests(18)
    provider.setRainForTests(true)
    provider.tick(2)

    const tank = await provider.getTankLevel()
    expect(tank.levelL.value).toBe(20)

    const water = await snapshot()
    expect(water.mainTankL.value).toBe(20)
    expect(water.tank.capacityL).toBe(20)
    expect(water.totalAvailableL.value).toBe(20)
  })

  it('does not count rainwater as a separate stored reserve', async () => {
    provider.setRainForTests(true)
    provider.tick(3)

    const sources = await provider.getSources()
    const rain = sources.find((s) => s.kind === 'rainwater')!
    expect(rain.hasOwnStorage).toBe(false)
    expect(rain.state.currentL.value).toBe(0)

    const water = await snapshot()
    expect(water.transferableSourceL.value).toBe(6100 + 4100 + 1000)
    expect(water.totalAvailableL.value).toBe(water.mainTankL.value)
    expect(water.totalAvailableL.value).not.toBe(water.mainTankL.value + water.transferableSourceL.value)
  })

  it('keeps existing flow-input tagging as configured-rate', () => {
    expect(provider.getFlowInputSource()).toBe('configured-rate')
    provider.setRainForTests(true)
    provider.tick(1)
    const rates = provider.getLastTickRatesLPerMin()
    expect(rates.waterInLPerMin).toBeGreaterThan(0)
  })

  it('still subtracts irrigation from the main tank', async () => {
    provider.setTankLevelForTests(500)
    provider.setRainForTests(false)
    await provider.setZoneValve('zone-a', true)
    const tick = provider.tick(2)
    expect(tick.waterUsedL).toBeGreaterThan(0)
    const tank = await provider.getTankLevel()
    expect(tank.levelL.value).toBeCloseTo(500 - tick.waterUsedL)
  })
})
