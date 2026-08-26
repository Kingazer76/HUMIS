import type { PlanningSnapshot, ShortageTier } from '@aquaflow/shared'
import { ACTIVE_FLOW_INPUT_SOURCE } from '../providers/flowInputSource.js'
import type { WeatherAdjustment } from './weatherProvider.js'

export const MINUTES_PER_DAY = 24 * 60
export const ROLLING_WINDOW_DAYS = 7

/** Below this much accumulated session time, there isn't enough observed usage yet to trust a rate — report 0 rather than an unstable extrapolation. */
const MIN_MINUTES_FOR_ESTIMATE = 1

/** Upper bound on the reported days-remaining figure so near-zero consumption reports "effectively fine" instead of an unbounded/huge number. */
export const DAYS_REMAINING_CAP = 365

const CRITICAL_DAYS_THRESHOLD = 3
const HIGH_DAYS_THRESHOLD = 7
const MODERATE_DAYS_THRESHOLD = 14

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * In-memory rolling usage window used by shortage prediction. This is not
 * the History log (that's a later piece of work) — it only keeps up to
 * 7 completed simulated days plus the current partial day so we can
 * compute a 7-day average without persisting a farm diary.
 */
export interface RollingConsumptionWindow {
  /** Oldest-first completed simulated days of usage (L). Capped at `ROLLING_WINDOW_DAYS`. */
  completedDaysUsedL: number[]
  currentDayUsedL: number
  currentDayMinutes: number
}

export function emptyRollingWindow(): RollingConsumptionWindow {
  return { completedDaysUsedL: [], currentDayUsedL: 0, currentDayMinutes: 0 }
}

function pushCompletedDay(completed: number[], dayUsedL: number): number[] {
  const next = [...completed, Math.max(0, dayUsedL)]
  return next.length > ROLLING_WINDOW_DAYS ? next.slice(-ROLLING_WINDOW_DAYS) : next
}

/**
 * Records usage into the rolling window. Splits a tick that crosses a
 * simulated-day boundary so each day's bucket only holds that day's water.
 * Pure: returns a new window; never divides by zero.
 */
export function recordConsumption(
  window: RollingConsumptionWindow,
  usedL: number,
  elapsedMinutes: number,
): RollingConsumptionWindow {
  const used = Math.max(0, usedL)
  let remainingMin = Math.max(0, elapsedMinutes)
  if (remainingMin === 0) {
    return {
      completedDaysUsedL: window.completedDaysUsedL.slice(-ROLLING_WINDOW_DAYS),
      currentDayUsedL: Math.max(0, window.currentDayUsedL),
      currentDayMinutes: Math.max(0, window.currentDayMinutes),
    }
  }

  let remainingUsed = used
  let completed = window.completedDaysUsedL.slice(-ROLLING_WINDOW_DAYS)
  let currentUsed = Math.max(0, window.currentDayUsedL)
  let currentMin = Math.max(0, window.currentDayMinutes)

  while (remainingMin > 0) {
    const room = MINUTES_PER_DAY - currentMin
    if (room <= 0) {
      completed = pushCompletedDay(completed, currentUsed)
      currentUsed = 0
      currentMin = 0
      continue
    }

    const sliceMin = Math.min(remainingMin, room)
    const sliceUsed = remainingUsed * (sliceMin / remainingMin)
    currentUsed += sliceUsed
    currentMin += sliceMin
    remainingUsed -= sliceUsed
    remainingMin -= sliceMin

    if (currentMin >= MINUTES_PER_DAY) {
      completed = pushCompletedDay(completed, currentUsed)
      currentUsed = 0
      currentMin = 0
    }
  }

  return { completedDaysUsedL: completed, currentDayUsedL: currentUsed, currentDayMinutes: currentMin }
}

export function observedDaysInWindow(window: RollingConsumptionWindow): number {
  const currentFraction = Math.max(0, window.currentDayMinutes) / MINUTES_PER_DAY
  return Math.min(ROLLING_WINDOW_DAYS, window.completedDaysUsedL.length + currentFraction)
}

/**
 * Turns this session's observed cumulative usage into a daily-consumption-rate
 * estimate. Same math as a 7-day average over a window that only has a
 * partial current day. Pure function: same inputs always produce the same output.
 */
export function estimateDailyConsumptionFromSessionL(
  usedSinceStartL: number,
  simulatedMinutesElapsed: number,
): number {
  return estimateSevenDayAverageL({
    completedDaysUsedL: [],
    currentDayUsedL: usedSinceStartL,
    currentDayMinutes: simulatedMinutesElapsed,
  })
}

/**
 * 7-day rolling average daily consumption (L/day).
 *
 * Uses the most recent 7 simulated days of the window (including the
 * current partial day as a fraction of a day). If fewer than 7 days of
 * data exist, averages over whatever has been observed — which is the
 * same as extrapolating the session so far to a daily rate.
 *
 * Never divides by zero. Zero usage or zero elapsed time returns 0.
 */
export function estimateSevenDayAverageL(window: RollingConsumptionWindow): number {
  const completed = window.completedDaysUsedL.map((d) => Math.max(0, d)).slice(-ROLLING_WINDOW_DAYS)
  const currentUsed = Math.max(0, window.currentDayUsedL)
  const currentMin = Math.max(0, window.currentDayMinutes)

  let remainingDays = ROLLING_WINDOW_DAYS
  let totalUsed = 0
  let totalDays = 0

  const currentDayFraction = currentMin / MINUTES_PER_DAY
  if (currentDayFraction > 0) {
    const take = Math.min(currentDayFraction, remainingDays)
    totalUsed += currentUsed * (take / currentDayFraction)
    totalDays += take
    remainingDays -= take
  }

  for (let i = completed.length - 1; i >= 0 && remainingDays > 0; i -= 1) {
    const take = Math.min(1, remainingDays)
    totalUsed += completed[i]! * take
    totalDays += take
    remainingDays -= take
  }

  if (totalDays <= 0 || totalUsed <= 0) return 0
  const totalMinutes = totalDays * MINUTES_PER_DAY
  if (totalMinutes < MIN_MINUTES_FOR_ESTIMATE) return 0
  return totalUsed / totalDays
}

export interface ShortagePredictionInput {
  /** Current main-tank water (L) — the one authoritative stored-water number; irrigation only ever draws from here. */
  availableTankL: number
  /** L/day, before any weather adjustment. Typically the 7-day rolling average. */
  dailyConsumptionL: number
  tankCapacityL: number
  lowThresholdPct: number
  criticalThresholdPct: number
  /** How many simulated days of usage the daily-consumption figure was averaged over. */
  observedDays?: number
  /** `null`/`undefined` means weather is unavailable — prediction proceeds unadjusted. Never required. */
  weatherAdjustment?: WeatherAdjustment | null
}

/**
 * The single authority for "how many days of water are left, and how
 * worried should we be?" Pure function, no I/O — reuses only inputs the
 * existing water-accounting/tank config already provide, plus an optional
 * weather adjustment that can be entirely absent without changing the
 * shape or validity of the result.
 *
 * Tier is driven primarily by projected days remaining, with the tank's
 * own configured thresholds acting as a hard floor — exactly the same
 * "critical overrides everything else" pattern `irrigationEngine` uses for
 * actuation, applied here to forecasting: a tank at/below its critical
 * threshold is always reported CRITICAL regardless of how light current
 * usage looks, and a tank at/below its low threshold is never reported
 * better than MODERATE.
 */
export function predictShortage(input: ShortagePredictionInput): PlanningSnapshot {
  const asOf = new Date().toISOString()
  const availableL = Math.max(0, input.availableTankL)
  const tankPct = input.tankCapacityL > 0 ? (availableL / input.tankCapacityL) * 100 : 0
  const sevenDayAverageL = Math.max(0, input.dailyConsumptionL)
  const observedDays = Math.round(Math.max(0, input.observedDays ?? 0) * 10000) / 10000

  const weatherApplied =
    input.weatherAdjustment != null && Number.isFinite(input.weatherAdjustment.demandMultiplier)
  const multiplier = weatherApplied ? Math.max(0, input.weatherAdjustment!.demandMultiplier) : 1
  const adjustedDailyConsumptionL = sevenDayAverageL * multiplier

  const daysRemainingRaw =
    adjustedDailyConsumptionL <= 0
      ? availableL > 0
        ? DAYS_REMAINING_CAP
        : 0
      : availableL / adjustedDailyConsumptionL
  const daysRemaining = clamp(daysRemainingRaw, 0, DAYS_REMAINING_CAP)

  let tier: ShortageTier
  let reason: string

  if (availableL <= 0 || tankPct <= input.criticalThresholdPct) {
    tier = 'critical'
    reason = `Main tank is at or below the critical threshold (${input.criticalThresholdPct}%).`
  } else if (daysRemaining <= CRITICAL_DAYS_THRESHOLD) {
    tier = 'critical'
    reason = `Estimated ${daysRemaining.toFixed(1)} days of water remaining at the current usage rate.`
  } else if (daysRemaining <= HIGH_DAYS_THRESHOLD) {
    tier = 'high'
    reason = `Estimated ${daysRemaining.toFixed(1)} days of water remaining at the current usage rate.`
  } else if (daysRemaining <= MODERATE_DAYS_THRESHOLD) {
    tier = 'moderate'
    reason = `Estimated ${daysRemaining.toFixed(1)} days of water remaining at the current usage rate.`
  } else if (tankPct <= input.lowThresholdPct) {
    tier = 'moderate'
    reason = `Reserves are below the low-water threshold (${input.lowThresholdPct}%), even though current usage is light.`
  } else {
    tier = 'low'
    reason = 'Reserves are healthy at the current usage rate.'
  }

  if (weatherApplied && multiplier !== 1) {
    reason += ' Adjusted for the current weather forecast.'
  } else if (weatherApplied) {
    reason += ' Weather forecast available; rainfall did not change the usage rate.'
  } else {
    reason += ' Weather forecast unavailable — based on sensor/usage data only.'
  }

  const flowReading = (value: number) => ({
    value,
    tag: 'estimated' as const,
    flowInputSource: ACTIVE_FLOW_INPUT_SOURCE,
    asOf,
  })

  return {
    daysRemaining: { value: Math.round(daysRemaining * 10) / 10, tag: 'forecast', asOf },
    tier,
    reason,
    sevenDayAverageConsumptionL: flowReading(sevenDayAverageL),
    adjustedDailyConsumptionL: flowReading(adjustedDailyConsumptionL),
    weatherApplied,
    observedDays,
    weather: { available: false },
  }
}
