import type {
  FlowInputSource,
  TankConfig,
  TankState,
  WaterSnapshot,
  WaterSource,
} from '@aquaflow/shared'

export interface WaterAccountingInput {
  tank: TankState
  tankConfig: TankConfig
  sources: WaterSource[]
  waterInLPerMin: number
  waterUsedLPerMin: number
  inflowSinceStartL: number
  usedSinceStartL: number
  flowInputSource: FlowInputSource
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * Pure aggregation: Main Tank Water, Transferable Source Water, and Total
 * Available Water as three explicit numbers (decision 3), plus the
 * always-estimated Water In / Water Used rates (decision 4). Never derives
 * a flow number from tank-level delta — the caller supplies rates that
 * were already computed from configured rate x duration.
 *
 * Available Water is the main tank only. External source reserves (well,
 * pond, manual) stay in `transferableSourceL` for the Water tab and are
 * not added in. Rainwater has no own reserve (`hasOwnStorage: false`).
 */
export function buildWaterSnapshot(input: WaterAccountingInput): WaterSnapshot {
  const asOf = new Date().toISOString()
  const mainTankL = clamp(input.tank.levelL.value, 0, input.tankConfig.capacityL)
  const transferableSourceL = input.sources.reduce((sum, s) => {
    if (!s.hasOwnStorage) return sum
    return sum + s.state.currentL.value
  }, 0)
  const totalAvailableL = mainTankL

  return {
    tank: { ...input.tankConfig, state: input.tank },
    mainTankL: { value: mainTankL, tag: input.tank.levelL.tag, asOf },
    transferableSourceL: { value: transferableSourceL, tag: 'simulated', asOf },
    totalAvailableL: { value: totalAvailableL, tag: 'simulated', asOf },
    waterInLPerMin: {
      value: input.waterInLPerMin,
      tag: 'estimated',
      flowInputSource: input.flowInputSource,
      asOf,
    },
    waterUsedLPerMin: {
      value: input.waterUsedLPerMin,
      tag: 'estimated',
      flowInputSource: input.flowInputSource,
      asOf,
    },
    inflowSinceStartL: {
      value: input.inflowSinceStartL,
      tag: 'estimated',
      flowInputSource: input.flowInputSource,
      asOf,
    },
    usedSinceStartL: {
      value: input.usedSinceStartL,
      tag: 'estimated',
      flowInputSource: input.flowInputSource,
      asOf,
    },
  }
}
