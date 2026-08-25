import { describe, expect, it } from 'vitest'
import {
  DAYS_REMAINING_CAP,
  MINUTES_PER_DAY,
  ROLLING_WINDOW_DAYS,
  emptyRollingWindow,
  estimateDailyConsumptionFromSessionL,
  estimateSevenDayAverageL,
  observedDaysInWindow,
  predictShortage,
  recordConsumption,
} from './shortagePrediction.js'
import { getWeatherAdjustmentSafely, type WeatherForecast, type WeatherProvider } from './weatherProvider.js'

const HEALTHY_TANK = {
  tankCapacityL: 15000,
  lowThresholdPct: 25,
  criticalThresholdPct: 15,
}

describe('estimateDailyConsumptionFromSessionL', () => {
  it('returns 0 when no time has elapsed yet (no division-by-zero)', () => {
    expect(estimateDailyConsumptionFromSessionL(0, 0)).toBe(0)
    expect(estimateDailyConsumptionFromSessionL(50, 0)).toBe(0)
  })

  it('returns 0 when nothing has been used yet, regardless of elapsed time', () => {
    expect(estimateDailyConsumptionFromSessionL(0, 100)).toBe(0)
  })

  it('extrapolates observed usage to a daily rate once enough time has elapsed', () => {
    // 50 L used over 10 simulated minutes -> 5 L/min -> 7200 L/day
    expect(estimateDailyConsumptionFromSessionL(50, 10)).toBe(7200)
  })

  it('never returns a negative value for negative/garbage inputs', () => {
    expect(estimateDailyConsumptionFromSessionL(-50, 10)).toBe(0)
    expect(estimateDailyConsumptionFromSessionL(50, -10)).toBe(0)
  })
})

describe('recordConsumption / estimateSevenDayAverageL', () => {
  it('keeps a partial day in the current-day bucket until a full simulated day elapses', () => {
    const window = recordConsumption(emptyRollingWindow(), 50, 10)
    expect(window.completedDaysUsedL).toEqual([])
    expect(window.currentDayUsedL).toBe(50)
    expect(window.currentDayMinutes).toBe(10)
    expect(estimateSevenDayAverageL(window)).toBe(7200)
  })

  it('rolls a completed simulated day when a full day of minutes elapses', () => {
    const window = recordConsumption(emptyRollingWindow(), 100, MINUTES_PER_DAY)
    expect(window.completedDaysUsedL).toEqual([100])
    expect(window.currentDayUsedL).toBe(0)
    expect(window.currentDayMinutes).toBe(0)
    expect(estimateSevenDayAverageL(window)).toBe(100)
  })

  it('splits a tick that crosses a day boundary across both days', () => {
    const almostFull = recordConsumption(emptyRollingWindow(), 90, MINUTES_PER_DAY - 10)
    const crossed = recordConsumption(almostFull, 20, 20)
    expect(crossed.completedDaysUsedL).toHaveLength(1)
    expect(crossed.completedDaysUsedL[0]).toBeCloseTo(100, 5) // 90 + half of 20
    expect(crossed.currentDayUsedL).toBeCloseTo(10, 5)
    expect(crossed.currentDayMinutes).toBe(10)
  })

  it('averages several complete days as the 7-day (or fewer) mean', () => {
    let window = emptyRollingWindow()
    window = recordConsumption(window, 100, MINUTES_PER_DAY)
    window = recordConsumption(window, 200, MINUTES_PER_DAY)
    window = recordConsumption(window, 300, MINUTES_PER_DAY)
    expect(estimateSevenDayAverageL(window)).toBe(200)
    expect(observedDaysInWindow(window)).toBe(3)
  })

  it('drops usage older than 7 simulated days from the rolling average', () => {
    let window = emptyRollingWindow()
    window = recordConsumption(window, 10_000, MINUTES_PER_DAY) // should fall out
    for (let i = 0; i < ROLLING_WINDOW_DAYS; i += 1) {
      window = recordConsumption(window, 100, MINUTES_PER_DAY)
    }
    expect(window.completedDaysUsedL).toHaveLength(ROLLING_WINDOW_DAYS)
    expect(window.completedDaysUsedL.includes(10_000)).toBe(false)
    expect(estimateSevenDayAverageL(window)).toBe(100)
    expect(observedDaysInWindow(window)).toBe(ROLLING_WINDOW_DAYS)
  })

  it('returns 0 for an empty window without dividing by zero', () => {
    expect(estimateSevenDayAverageL(emptyRollingWindow())).toBe(0)
    expect(observedDaysInWindow(emptyRollingWindow())).toBe(0)
  })

  it('treats a 7-day window with zero usage as zero consumption, not NaN/Infinity', () => {
    let window = emptyRollingWindow()
    for (let i = 0; i < ROLLING_WINDOW_DAYS; i += 1) {
      window = recordConsumption(window, 0, MINUTES_PER_DAY)
    }
    expect(estimateSevenDayAverageL(window)).toBe(0)
    expect(Number.isFinite(estimateSevenDayAverageL(window))).toBe(true)
  })
})

describe('predictShortage', () => {
  it('computes a normal days-remaining figure for typical inputs', () => {
    // 9000 L available, 300 L/day -> 30 days
    const result = predictShortage({
      availableTankL: 9000,
      dailyConsumptionL: 300,
      ...HEALTHY_TANK,
    })
    expect(result.daysRemaining.value).toBeCloseTo(30, 1)
    expect(result.daysRemaining.tag).toBe('forecast')
    expect(result.tier).toBe('low')
    expect(result.sevenDayAverageConsumptionL.value).toBe(300)
  })

  it('handles zero consumption without producing Infinity or NaN, and reports a capped, safe days-remaining figure', () => {
    const result = predictShortage({
      availableTankL: 9000,
      dailyConsumptionL: 0,
      ...HEALTHY_TANK,
    })
    expect(Number.isFinite(result.daysRemaining.value)).toBe(true)
    expect(result.daysRemaining.value).toBe(DAYS_REMAINING_CAP)
    expect(result.daysRemaining.value).toBeGreaterThan(0)
    expect(result.tier).toBe('low')
  })

  it('reports zero days remaining and CRITICAL when available tank water is zero, even with zero consumption', () => {
    const result = predictShortage({
      availableTankL: 0,
      dailyConsumptionL: 0,
      ...HEALTHY_TANK,
    })
    expect(result.daysRemaining.value).toBe(0)
    expect(result.tier).toBe('critical')
  })

  it('reports zero days remaining and CRITICAL when available tank water is negative (defensive clamp)', () => {
    const result = predictShortage({
      availableTankL: -500,
      dailyConsumptionL: 100,
      ...HEALTHY_TANK,
    })
    expect(result.daysRemaining.value).toBe(0)
    expect(result.tier).toBe('critical')
  })

  it('handles very high consumption relative to available water without going negative or crashing', () => {
    const result = predictShortage({
      availableTankL: 1000,
      dailyConsumptionL: 1_000_000,
      ...HEALTHY_TANK,
    })
    expect(result.daysRemaining.value).toBeGreaterThanOrEqual(0)
    expect(Number.isFinite(result.daysRemaining.value)).toBe(true)
    expect(result.tier).toBe('critical')
  })

  it('never reports a negative days-remaining value across a range of extreme inputs', () => {
    const cases = [
      { availableTankL: 0, dailyConsumptionL: 0 },
      { availableTankL: -1000, dailyConsumptionL: -1000 },
      { availableTankL: 15000, dailyConsumptionL: 999_999_999 },
    ]
    for (const c of cases) {
      const result = predictShortage({ ...c, ...HEALTHY_TANK })
      expect(result.daysRemaining.value).toBeGreaterThanOrEqual(0)
    }
  })

  it('classifies LOW when reserves are healthy and days remaining is comfortably high', () => {
    const result = predictShortage({ availableTankL: 12000, dailyConsumptionL: 200, ...HEALTHY_TANK }) // 60 days
    expect(result.tier).toBe('low')
  })

  it('classifies MODERATE when days remaining falls in the moderate band', () => {
    // 6000 L (40% of capacity, comfortably above both tank thresholds) / 500 L/day
    // = 12 days, between the HIGH (7) and MODERATE (14) day thresholds — isolates
    // the pure days-based classification from the tank-percentage overrides.
    const result = predictShortage({ availableTankL: 6000, dailyConsumptionL: 500, ...HEALTHY_TANK })
    expect(result.tier).toBe('moderate')
  })

  it('classifies MODERATE (not LOW) when the tank is below the low-water threshold even though usage is very light', () => {
    // 3000 L = 20% of 15,000 L capacity -> below the 25% low threshold, above the 15% critical threshold.
    // Consumption is deliberately tiny so the days-remaining math alone would suggest LOW.
    const result = predictShortage({ availableTankL: 3000, dailyConsumptionL: 1, ...HEALTHY_TANK })
    expect(result.tier).toBe('moderate')
    expect(result.reason).toMatch(/low-water threshold/i)
  })

  it('classifies HIGH when days remaining falls in the high-risk band', () => {
    // 3000 L (20% of capacity, above the 15% critical threshold so the tank-pct
    // override doesn't fire) / 500 L/day = 6 days, between CRITICAL (3) and HIGH (7).
    const result = predictShortage({ availableTankL: 3000, dailyConsumptionL: 500, ...HEALTHY_TANK })
    expect(result.tier).toBe('high')
  })

  it('classifies CRITICAL (via the days-remaining threshold, not the tank-percentage override) when days remaining is very low', () => {
    // 2500 L (16.7% of capacity, above the 15% critical threshold) / 1000 L/day
    // = 2.5 days, at or below the CRITICAL (3) day threshold.
    const result = predictShortage({ availableTankL: 2500, dailyConsumptionL: 1000, ...HEALTHY_TANK })
    expect(result.tier).toBe('critical')
    expect(result.reason).toMatch(/days of water remaining/i)
  })

  it('classifies CRITICAL immediately when the tank percentage is at/below the critical threshold, even with many days of light usage left', () => {
    // 2000 L = 13.3% of 15,000 L, below the 15% critical threshold. Consumption is
    // deliberately tiny so days-remaining alone would suggest LOW/MODERATE.
    const result = predictShortage({ availableTankL: 2000, dailyConsumptionL: 5, ...HEALTHY_TANK })
    expect(result.tier).toBe('critical')
    expect(result.reason).toMatch(/critical threshold/i)
  })

  it('proceeds safely and correctly when weather is unavailable (undefined)', () => {
    const result = predictShortage({ availableTankL: 9000, dailyConsumptionL: 300, ...HEALTHY_TANK })
    expect(result.weatherApplied).toBe(false)
    expect(result.adjustedDailyConsumptionL.value).toBe(300)
    expect(result.reason).toMatch(/weather forecast unavailable/i)
  })

  it('proceeds safely and correctly when weather is explicitly null', () => {
    const result = predictShortage({
      availableTankL: 9000,
      dailyConsumptionL: 300,
      weatherAdjustment: null,
      ...HEALTHY_TANK,
    })
    expect(result.weatherApplied).toBe(false)
    expect(result.adjustedDailyConsumptionL.value).toBe(300)
    expect(result.sevenDayAverageConsumptionL.value).toBe(300)
  })

  it('treats a multiplier of 1 as weather available without changing the usage rate', () => {
    const result = predictShortage({
      availableTankL: 9000,
      dailyConsumptionL: 300,
      weatherAdjustment: { demandMultiplier: 1 },
      ...HEALTHY_TANK,
    })
    expect(result.weatherApplied).toBe(true)
    expect(result.adjustedDailyConsumptionL.value).toBe(300)
    expect(result.reason).toMatch(/weather forecast available/i)
    expect(result.reason).not.toMatch(/unavailable/i)
  })

  it('applies a valid weather adjustment when provided', () => {
    const result = predictShortage({
      availableTankL: 9000,
      dailyConsumptionL: 300,
      weatherAdjustment: { demandMultiplier: 0.85 },
      ...HEALTHY_TANK,
    })
    expect(result.weatherApplied).toBe(true)
    expect(result.sevenDayAverageConsumptionL.value).toBe(300)
    expect(result.adjustedDailyConsumptionL.value).toBeCloseTo(255, 5)
    expect(result.reason).toMatch(/adjusted for the current weather forecast/i)
  })

  it('ignores a malformed weather adjustment (non-finite multiplier) rather than corrupting the calculation', () => {
    const result = predictShortage({
      availableTankL: 9000,
      dailyConsumptionL: 300,
      weatherAdjustment: { demandMultiplier: Number.NaN },
      ...HEALTHY_TANK,
    })
    expect(result.weatherApplied).toBe(false)
    expect(result.adjustedDailyConsumptionL.value).toBe(300)
  })

  it('still returns a valid prediction when the weather provider throws (composed through the fail-safe wrapper)', async () => {
    const throwing: WeatherProvider = {
      async getForecast(): Promise<WeatherForecast | null> {
        throw new Error('weather service unreachable')
      },
    }
    const weatherAdjustment = await getWeatherAdjustmentSafely(throwing)
    expect(weatherAdjustment).toBeNull()

    const result = predictShortage({
      availableTankL: 9000,
      dailyConsumptionL: 300,
      weatherAdjustment,
      ...HEALTHY_TANK,
    })
    expect(result.weatherApplied).toBe(false)
    expect(result.daysRemaining.value).toBeCloseTo(30, 1)
    expect(result.tier).toBe('low')
    expect(Number.isFinite(result.daysRemaining.value)).toBe(true)
  })

  it('tags consumption figures as estimated with the active flow input source, never as measured', () => {
    const result = predictShortage({ availableTankL: 9000, dailyConsumptionL: 300, ...HEALTHY_TANK })
    expect(result.adjustedDailyConsumptionL.tag).toBe('estimated')
    expect(result.sevenDayAverageConsumptionL.tag).toBe('estimated')
    expect(result.adjustedDailyConsumptionL.tag).not.toBe('measured')
    expect(result.adjustedDailyConsumptionL.flowInputSource).toBe('configured-rate')
  })

  it('handles a zero tank capacity defensively without dividing by zero', () => {
    const result = predictShortage({
      availableTankL: 100,
      dailyConsumptionL: 10,
      tankCapacityL: 0,
      lowThresholdPct: 25,
      criticalThresholdPct: 15,
    })
    expect(Number.isFinite(result.daysRemaining.value)).toBe(true)
    expect(result.tier).toBe('critical') // 0% capacity always reads as at/below critical
  })
})
