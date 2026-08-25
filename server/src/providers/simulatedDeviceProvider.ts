import type {
  CropProfile,
  IrrigationZone,
  IrrigationZoneConfig,
  OperationMode,
  PumpStateReading,
  RainStatusReading,
  SystemStatusReading,
  TankState,
  WaterSource,
} from '@aquaflow/shared'
import {
  CROP_PROFILES,
  INITIAL_SOURCE_STATE,
  INITIAL_TANK_LEVEL_L,
  INITIAL_ZONE_MOISTURE_PCT,
  IRRIGATION_ZONE_CONFIGS,
  TANK_CONFIG,
  WATER_SOURCE_CONFIGS,
} from '../config/seedData.js'
import {
  emptyRollingWindow,
  recordConsumption,
  type RollingConsumptionWindow,
} from '../forecast/shortagePrediction.js'
import type { DeviceProvider } from './deviceProvider.js'
import { ACTIVE_FLOW_INPUT_SOURCE } from './flowInputSource.js'

function nowIso(): string {
  return new Date().toISOString()
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

interface SourceInternalState {
  currentL: number
  active: boolean
}

interface ZoneInternalState {
  soilMoisturePct: number
  active: boolean
  lastWateredAt: string | null
}

/** What one tick actually did — used by waterAccounting to build tagged readings. */
export interface TickResult {
  waterInL: number
  waterUsedL: number
  isRaining: boolean
}

/**
 * Reports plausible farm state without any real hardware attached.
 *
 * Every tick: active sources transfer configured-rate x duration into the
 * tank (depleting themselves as they do), active zones consume
 * configured-rate x duration from the tank (nothing sets a zone active yet
 * — that arrives with Phase 3's safety controller), soil moisture drifts
 * slowly downward with small sensor-like jitter, and rain is a simple
 * probabilistic event that tops up the rainwater source.
 *
 * Tank level is the one number this class treats as authoritative
 * "ground truth" for stored water — it is simulated today, and becomes
 * `measured` the moment `ESP32DeviceProvider` reads a real HC-SR04 sensor,
 * with no change to how anything downstream consumes it.
 */
export class SimulatedDeviceProvider implements DeviceProvider {
  private tankLevelL = INITIAL_TANK_LEVEL_L
  private sources = new Map<string, SourceInternalState>(
    WATER_SOURCE_CONFIGS.map((cfg) => [cfg.id, { ...INITIAL_SOURCE_STATE[cfg.id] }]),
  )
  private zones = new Map<string, ZoneInternalState>(
    IRRIGATION_ZONE_CONFIGS.map((cfg) => [
      cfg.id,
      { soilMoisturePct: INITIAL_ZONE_MOISTURE_PCT[cfg.id] ?? 50, active: false, lastWateredAt: null },
    ]),
  )
  private pumpOn = false
  private operationMode: OperationMode = 'auto'
  private isRaining = false
  private rainTicksRemaining = 0

  private cumulativeInflowL = 0
  private cumulativeUsedL = 0
  private simulatedMinutesElapsed = 0
  private lastWaterInLPerMin = 0
  private lastWaterUsedLPerMin = 0
  /** Last-7-simulated-days usage buckets for shortage prediction. Not a history log. */
  private rollingConsumption = emptyRollingWindow()
  private cumulativeUsedByZoneL = new Map<string, number>(IRRIGATION_ZONE_CONFIGS.map((cfg) => [cfg.id, 0]))

  private cropById = new Map<string, CropProfile>(CROP_PROFILES.map((c) => [c.id, c]))
  private zoneConfigById = new Map<string, IrrigationZoneConfig>(
    IRRIGATION_ZONE_CONFIGS.map((c) => [c.id, c]),
  )

  /**
   * Advances the simulation by `elapsedMinutes` of simulated time. Returns
   * exactly what happened so `waterAccounting`/history can report honest,
   * derived-from-this-tick numbers rather than re-deriving them from a
   * tank-level delta.
   */
  tick(elapsedMinutes: number): TickResult {
    this.advanceRain()

    let waterInL = 0
    for (const cfg of WATER_SOURCE_CONFIGS) {
      const source = this.sources.get(cfg.id)
      if (!source || !source.active || cfg.nominalTransferRateLPerMin <= 0) continue
      const requested = cfg.nominalTransferRateLPerMin * elapsedMinutes
      const transferred = Math.min(requested, source.currentL)
      if (transferred <= 0) continue
      source.currentL = clamp(source.currentL - transferred, 0, cfg.capacityL)
      waterInL += transferred
    }

    // Rain tops up the rainwater harvesting reserve directly (independent of its transfer-out rate).
    if (this.isRaining) {
      const rainCfg = WATER_SOURCE_CONFIGS.find((c) => c.kind === 'rainwater')
      const rainSource = rainCfg ? this.sources.get(rainCfg.id) : undefined
      if (rainCfg && rainSource) {
        rainSource.currentL = clamp(rainSource.currentL + 2.5 * elapsedMinutes, 0, rainCfg.capacityL)
      }
    }

    let waterUsedL = 0
    for (const cfg of IRRIGATION_ZONE_CONFIGS) {
      const zone = this.zones.get(cfg.id)
      if (!zone) continue

      // Environmental drift: soil slowly dries out, with small sensor-like jitter.
      // This is unrelated to irrigation decisions (Phase 3 owns those) — it's
      // just what a real capacitive moisture sensor would plausibly report.
      const dryingRate = 0.03 // % per simulated minute
      const jitter = (Math.random() - 0.5) * 0.3
      zone.soilMoisturePct = clamp(zone.soilMoisturePct - dryingRate * elapsedMinutes + jitter, 10, 95)

      if (!zone.active) continue
      const requested = cfg.nominalOutflowRateLPerMin * elapsedMinutes
      const used = Math.min(requested, this.tankLevelL - waterUsedL)
      if (used <= 0) continue
      waterUsedL += used
      zone.lastWateredAt = nowIso()
      this.cumulativeUsedByZoneL.set(cfg.id, (this.cumulativeUsedByZoneL.get(cfg.id) ?? 0) + used)
    }

    this.tankLevelL = clamp(this.tankLevelL + waterInL - waterUsedL, 0, TANK_CONFIG.capacityL)
    this.cumulativeInflowL += waterInL
    this.cumulativeUsedL += waterUsedL
    this.simulatedMinutesElapsed += elapsedMinutes
    this.rollingConsumption = recordConsumption(this.rollingConsumption, waterUsedL, elapsedMinutes)
    this.lastWaterInLPerMin = elapsedMinutes > 0 ? waterInL / elapsedMinutes : 0
    this.lastWaterUsedLPerMin = elapsedMinutes > 0 ? waterUsedL / elapsedMinutes : 0

    return { waterInL, waterUsedL, isRaining: this.isRaining }
  }

  private advanceRain(): void {
    if (this.isRaining) {
      this.rainTicksRemaining -= 1
      if (this.rainTicksRemaining <= 0) this.isRaining = false
      return
    }
    if (Math.random() < 0.08) {
      this.isRaining = true
      this.rainTicksRemaining = 3 + Math.floor(Math.random() * 4)
    }
  }

  // --- DeviceProvider ---------------------------------------------------

  async getTankLevel(): Promise<TankState> {
    return { levelL: { value: this.tankLevelL, tag: 'simulated', asOf: nowIso() } }
  }

  async getSources(): Promise<WaterSource[]> {
    return WATER_SOURCE_CONFIGS.map((cfg) => {
      const state = this.sources.get(cfg.id)!
      return {
        ...cfg,
        state: {
          id: cfg.id,
          currentL: { value: state.currentL, tag: 'simulated', asOf: nowIso() },
          active: state.active,
        },
      }
    })
  }

  async getZones(): Promise<IrrigationZone[]> {
    return IRRIGATION_ZONE_CONFIGS.map((cfg) => {
      const state = this.zones.get(cfg.id)!
      const crop = this.cropById.get(cfg.cropId)
      if (!crop) throw new Error(`Unknown crop for zone ${cfg.id}`)
      return {
        ...cfg,
        crop,
        state: {
          id: cfg.id,
          soilMoisturePct: { value: state.soilMoisturePct, tag: 'simulated', asOf: nowIso() },
          active: state.active,
          lastWateredAt: state.lastWateredAt,
        },
      }
    })
  }

  async getZoneConfig(zoneId: string): Promise<IrrigationZoneConfig | undefined> {
    return this.zoneConfigById.get(zoneId)
  }

  async getRainStatus(): Promise<RainStatusReading> {
    return { isRaining: { value: this.isRaining, tag: 'simulated', asOf: nowIso() } }
  }

  async getPumpStatus(): Promise<PumpStateReading> {
    return { isOn: { value: this.pumpOn, tag: 'simulated', asOf: nowIso() } }
  }

  async getOperationMode(): Promise<OperationMode> {
    return this.operationMode
  }

  async getSystemStatus(): Promise<SystemStatusReading> {
    const anyZoneActive = [...this.zones.values()].some((z) => z.active)
    const allZonesSufficient = IRRIGATION_ZONE_CONFIGS.every((cfg) => {
      const state = this.zones.get(cfg.id)
      const minPct = cfg.overrideMinPct ?? this.cropById.get(cfg.cropId)?.defaultMinMoisturePct ?? 0
      return (state?.soilMoisturePct ?? 0) > minPct
    })

    const phase: SystemStatusReading['phase'] = anyZoneActive
      ? 'irrigating'
      : this.isRaining
        ? 'rain-detected'
        : this.tankLevelL / TANK_CONFIG.capacityL < TANK_CONFIG.criticalThresholdPct / 100
          ? 'low-water'
          : allZonesSufficient
            ? 'soil-moisture-sufficient'
            : 'waiting'
    return { phase, operationMode: this.operationMode }
  }

  async setPumpState(isOn: boolean): Promise<void> {
    this.pumpOn = isOn
  }

  async setZoneValve(zoneId: string, isOn: boolean): Promise<void> {
    const zone = this.zones.get(zoneId)
    if (!zone) throw new Error(`Unknown zone: ${zoneId}`)
    zone.active = isOn
  }

  async setOperationMode(mode: OperationMode): Promise<void> {
    this.operationMode = mode
  }

  // --- internals exposed for waterAccounting / shortagePrediction / tests --------------------

  /** Total simulated minutes advanced since this provider was constructed. */
  getSimulatedMinutesElapsed(): number {
    return this.simulatedMinutesElapsed
  }

  /**
   * Rolling 7-day usage window for `shortagePrediction`. This is not the
   * History tab's log — it only keeps enough buckets to average recent
   * consumption, and resets when the process restarts.
   */
  getRollingConsumptionWindow(): RollingConsumptionWindow {
    return {
      completedDaysUsedL: [...this.rollingConsumption.completedDaysUsedL],
      currentDayUsedL: this.rollingConsumption.currentDayUsedL,
      currentDayMinutes: this.rollingConsumption.currentDayMinutes,
    }
  }

  getCumulativeTotalsL(): { inflowL: number; usedL: number } {
    return { inflowL: this.cumulativeInflowL, usedL: this.cumulativeUsedL }
  }

  /** Estimated litres this zone has used since the provider was constructed (configured rate × time active). */
  getCumulativeUsedByZoneL(zoneId: string): number {
    return this.cumulativeUsedByZoneL.get(zoneId) ?? 0
  }

  getLastTickRatesLPerMin(): { waterInLPerMin: number; waterUsedLPerMin: number } {
    return { waterInLPerMin: this.lastWaterInLPerMin, waterUsedLPerMin: this.lastWaterUsedLPerMin }
  }

  getFlowInputSource() {
    return ACTIVE_FLOW_INPUT_SOURCE
  }
}
