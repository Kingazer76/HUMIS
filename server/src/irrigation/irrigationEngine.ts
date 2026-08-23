import type { IrrigationZone } from '@aquaflow/shared'

export type ZoneDecisionAction = 'start' | 'stop' | 'hold'

export interface ZoneDecision {
  action: ZoneDecisionAction
  reason: string
}

export interface ZoneDecisionInput {
  zone: IrrigationZone
  tankLevelPct: number
  criticalThresholdPct: number
}

/**
 * The single authority for "should this zone be irrigating right now?"
 * Pure function: same inputs always produce the same decision, no I/O, no
 * side effects — `safetyController` is the only thing allowed to act on
 * the decision.
 *
 * Hysteresis: uses the zone's own configured target range as the enter/exit
 * thresholds rather than a single toggle point. A zone starts only once
 * moisture falls to/below its target minimum, and — once started — keeps
 * running until moisture reaches the target maximum, not merely back above
 * the minimum. Because min and max are well separated (e.g. 40-60%), this
 * naturally prevents the rapid on/off cycling a single-threshold rule would
 * cause from ordinary sensor jitter, without needing an extra arbitrary
 * buffer band.
 *
 * A critical tank level always wins over the hysteresis decision: it forces
 * an immediate stop (or withholds a start) regardless of how dry the soil
 * is. `safetyController` re-checks this independently against a fresh
 * reading before acting — this function's tank check exists so the
 * *recommendation* is already safety-aware, not to be the sole enforcement
 * point.
 */
export function decideZoneIrrigation(input: ZoneDecisionInput): ZoneDecision {
  const { zone, tankLevelPct, criticalThresholdPct } = input
  const minPct = zone.overrideMinPct ?? zone.crop.defaultMinMoisturePct
  const maxPct = zone.overrideMaxPct ?? zone.crop.defaultMaxMoisturePct
  const moisture = zone.state.soilMoisturePct.value
  const active = zone.state.active

  if (tankLevelPct <= criticalThresholdPct) {
    return active
      ? { action: 'stop', reason: `Tank level at or below critical threshold (${criticalThresholdPct}%)` }
      : {
          action: 'hold',
          reason: `Tank level at or below critical threshold (${criticalThresholdPct}%); irrigation withheld`,
        }
  }

  if (active) {
    if (moisture >= maxPct) {
      return { action: 'stop', reason: `Soil moisture reached target maximum (${maxPct}%)` }
    }
    return { action: 'hold', reason: `Continuing irrigation until target maximum (${maxPct}%) is reached` }
  }

  if (moisture <= minPct) {
    return { action: 'start', reason: `Soil moisture at or below target minimum (${minPct}%)` }
  }
  return { action: 'hold', reason: 'Soil moisture within target range' }
}
