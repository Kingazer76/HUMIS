import type {
  DataTag,
  HistoryRecord,
  IrrigationZone,
  SoilCondition,
  WateringAction,
} from '@aquaflow/shared'

export const DEFAULT_HISTORY_LIMIT = 200
export const SNAPSHOT_EVERY_SIM_MINUTES = 12

export interface ZoneHistoryInput {
  id: string
  name: string
  cropName: string
  soilMoisturePct: number
  minPct: number
  maxPct: number
  active: boolean
  usedSinceStartL: number
  tag: DataTag
}

/**
 * Uses each zone's own target min/max (the same numbers `irrigationEngine`
 * already uses) so History does not invent a second soil scale.
 */
export function describeSoilCondition(moisturePct: number, minPct: number, maxPct: number): SoilCondition {
  if (moisturePct <= minPct) return 'dry'
  if (moisturePct >= maxPct) return 'wet'
  return 'healthy'
}

export function zoneToHistoryInput(zone: IrrigationZone, usedSinceStartL: number): ZoneHistoryInput {
  return {
    id: zone.id,
    name: zone.name,
    cropName: zone.crop.name,
    soilMoisturePct: zone.state.soilMoisturePct.value,
    minPct: zone.overrideMinPct ?? zone.crop.defaultMinMoisturePct,
    maxPct: zone.overrideMaxPct ?? zone.crop.defaultMaxMoisturePct,
    active: zone.state.active,
    usedSinceStartL: Math.max(0, usedSinceStartL),
    tag: zone.state.soilMoisturePct.tag,
  }
}

/**
 * Append-only in-memory farm diary. Prototype-only: lives in this process
 * and resets on server restart. Not a second farm model — it only copies
 * tank/zone/usage numbers the simulation already produced.
 */
export class HistoryLog {
  private records: HistoryRecord[] = []
  private nextId = 1
  private simMinutesSinceSnapshot = 0
  private sessionStartUsedL = new Map<string, number>()
  private lastSnapshotUsedL = new Map<string, number>()

  constructor(private readonly maxRecords: number = DEFAULT_HISTORY_LIMIT) {}

  list(): HistoryRecord[] {
    return [...this.records].reverse()
  }

  size(): number {
    return this.records.length
  }

  resetForTests(): void {
    this.records = []
    this.nextId = 1
    this.simMinutesSinceSnapshot = 0
    this.sessionStartUsedL.clear()
    this.lastSnapshotUsedL.clear()
  }

  /**
   * Records a valve start/stop. Water used on start is 0; on stop it is
   * the estimated litres used while that field was watering.
   */
  recordIrrigationEvent(input: {
    zone: ZoneHistoryInput
    wateringAction: Extract<WateringAction, 'started' | 'stopped'>
    tankLevelL: number
    recordedAt?: string
  }): HistoryRecord {
    let waterUsedL = 0
    if (input.wateringAction === 'started') {
      this.sessionStartUsedL.set(input.zone.id, input.zone.usedSinceStartL)
    } else {
      const startedAt = this.sessionStartUsedL.get(input.zone.id) ?? 0
      waterUsedL = Math.max(0, input.zone.usedSinceStartL - startedAt)
      this.sessionStartUsedL.delete(input.zone.id)
    }

    const record = this.buildRecord({
      kind: 'irrigation-event',
      zone: input.zone,
      wateringAction: input.wateringAction,
      waterUsedL,
      tankLevelL: input.tankLevelL,
      recordedAt: input.recordedAt,
    })
    this.push(record)
    return record
  }

  /** Advances simulated time and, when due, writes one snapshot row per field. */
  ingestElapsed(elapsedMinutes: number, farm: { tankLevelL: number; zones: ZoneHistoryInput[] }): HistoryRecord[] {
    const minutes = Math.max(0, elapsedMinutes)
    this.simMinutesSinceSnapshot += minutes
    if (this.simMinutesSinceSnapshot < SNAPSHOT_EVERY_SIM_MINUTES) return []
    this.simMinutesSinceSnapshot = 0
    return farm.zones.map((zone) => this.recordFarmSnapshot({ zone, tankLevelL: farm.tankLevelL }))
  }

  recordFarmSnapshot(input: { zone: ZoneHistoryInput; tankLevelL: number; recordedAt?: string }): HistoryRecord {
    const previous = this.lastSnapshotUsedL.get(input.zone.id) ?? 0
    const waterUsedL = Math.max(0, input.zone.usedSinceStartL - previous)
    this.lastSnapshotUsedL.set(input.zone.id, input.zone.usedSinceStartL)

    const record = this.buildRecord({
      kind: 'farm-snapshot',
      zone: input.zone,
      wateringAction: input.zone.active ? 'watering' : 'idle',
      waterUsedL,
      tankLevelL: input.tankLevelL,
      recordedAt: input.recordedAt,
    })
    this.push(record)
    return record
  }

  private buildRecord(input: {
    kind: HistoryRecord['kind']
    zone: ZoneHistoryInput
    wateringAction: WateringAction
    waterUsedL: number
    tankLevelL: number
    recordedAt?: string
  }): HistoryRecord {
    const recordedAt = input.recordedAt ?? new Date().toISOString()
    return {
      id: `hist-${this.nextId++}`,
      recordedAt,
      kind: input.kind,
      tag: input.zone.tag,
      zoneId: input.zone.id,
      zoneName: input.zone.name,
      cropName: input.zone.cropName,
      soilMoisturePct: input.zone.soilMoisturePct,
      soilCondition: describeSoilCondition(input.zone.soilMoisturePct, input.zone.minPct, input.zone.maxPct),
      wateringAction: input.wateringAction,
      waterUsedL: input.waterUsedL,
      tankLevelL: Math.max(0, input.tankLevelL),
    }
  }

  private push(record: HistoryRecord): void {
    this.records.push(record)
    const overflow = this.records.length - this.maxRecords
    if (overflow > 0) this.records.splice(0, overflow)
  }
}

export const historyLog = new HistoryLog()
