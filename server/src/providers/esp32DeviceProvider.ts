import {
  moistureTargetsForZone,
  type CropProfile,
  type IrrigationZone,
  type IrrigationZoneConfig,
  type OperationMode,
  type PumpStateReading,
  type RainStatusReading,
  type SystemStatusReading,
  type TankState,
  type WaterSource,
} from '@aquaflow/shared'
import { getHardwareCalibration, getTankConfig } from '../config/farmSettings.js'
import {
  CROP_PROFILES,
  INITIAL_SOURCE_STATE,
  INITIAL_ZONE_MOISTURE_PCT,
  IRRIGATION_ZONE_CONFIGS,
  WATER_SOURCE_CONFIGS,
} from '../config/seedData.js'
import {
  emptyRollingWindow,
  recordConsumption,
  type RollingConsumptionWindow,
} from '../forecast/shortagePrediction.js'
import { isValidUltrasonicCm, soilAdcToPercent, tankDistanceToLitres } from '../hardware/conversions.js'
import { isPinAssigned, UNASSIGNED_GPIO } from '../hardware/gpioPins.js'
import {
  forcePumpOff,
  getLastTelemetry,
  isTelemetryFresh,
  setMaxPumpOnSeconds,
  setPumpCommand,
  setValveCommand,
} from '../hardware/hardwareStore.js'
import type { DeviceProvider } from './deviceProvider.js'
import { ACTIVE_FLOW_INPUT_SOURCE } from './flowInputSource.js'

const ZONE_A = 'zone-a'
const ZONE_B = 'zone-b'
const NEVER_AS_OF = '1970-01-01T00:00:00.000Z'

function nowIso(): string {
  return new Date().toISOString()
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function isoFromMs(ms: number | undefined): string {
  if (!ms) return NEVER_AS_OF
  return new Date(ms).toISOString()
}

function copyZoneConfigs(): Map<string, IrrigationZoneConfig> {
  return new Map(IRRIGATION_ZONE_CONFIGS.map((c) => [c.id, { ...c }]))
}

interface ZoneInternalState {
  soilMoisturePct: number
  soilAsOf: string
  soilTag: 'measured' | 'simulated'
  soilValid: boolean
  active: boolean
  lastWateredAt: string | null
}

/**
 * Real ESP32 hardware behind the existing DeviceProvider door.
 *
 * HUMIS still decides crops, weather, planning, and Assistant actions.
 * This class only:
 *   - reads last telemetry the board posted
 *   - converts distance → litres and ADC → Zone A moisture
 *   - writes pump/valve commands for the board to pick up
 *   - keeps Zone B as a local simulated field until a second soil probe exists
 *
 * It is not a second irrigation brain.
 */
export class ESP32DeviceProvider implements DeviceProvider {
  private operationMode: OperationMode = 'auto'
  private desiredPumpOn = false
  private sources = new Map(WATER_SOURCE_CONFIGS.map((cfg) => [cfg.id, { ...INITIAL_SOURCE_STATE[cfg.id] }]))
  private zoneConfigById = copyZoneConfigs()
  private cropById = new Map<string, CropProfile>(CROP_PROFILES.map((c) => [c.id, c]))
  private zones = new Map<string, ZoneInternalState>([
    [
      ZONE_A,
      {
        soilMoisturePct: 0,
        soilAsOf: NEVER_AS_OF,
        soilTag: 'measured',
        soilValid: false,
        active: false,
        lastWateredAt: null,
      },
    ],
    [
      ZONE_B,
      {
        soilMoisturePct: INITIAL_ZONE_MOISTURE_PCT[ZONE_B] ?? 52,
        soilAsOf: nowIso(),
        soilTag: 'simulated',
        soilValid: true,
        active: false,
        lastWateredAt: null,
      },
    ],
  ])

  private cumulativeInflowL = 0
  private cumulativeUsedL = 0
  private lastWaterInLPerMin = 0
  private lastWaterUsedLPerMin = 0
  private rollingConsumption = emptyRollingWindow()
  private cumulativeUsedByZoneL = new Map<string, number>(IRRIGATION_ZONE_CONFIGS.map((cfg) => [cfg.id, 0]))

  /** Apply the latest ESP32 report onto Zone A, tank, and rain. Called on every read. */
  private ingestLatestTelemetry(): void {
    const telemetry = getLastTelemetry()
    const calibration = getHardwareCalibration()
    setMaxPumpOnSeconds(calibration.maxPumpOnSeconds)

    if (!telemetry) return
    const asOf = isoFromMs(telemetry.receivedAt)
    const zoneA = this.zones.get(ZONE_A)
    if (zoneA) {
      const pct = soilAdcToPercent(telemetry.soilAdc, calibration)
      if (pct === null) {
        zoneA.soilValid = false
        zoneA.soilMoisturePct = Number.NaN
        zoneA.soilAsOf = asOf
        zoneA.soilTag = 'measured'
      } else {
        zoneA.soilValid = true
        zoneA.soilMoisturePct = pct
        zoneA.soilAsOf = asOf
        zoneA.soilTag = 'measured'
      }
    }
  }

  /**
   * Physical fail-safe on the HUMIS command side: lost or invalid tank
   * readings force pump OFF. The ESP32 still has its own copy of this rule.
   * Crop / weather / planning stay in HUMIS.
   */
  applyPhysicalFailsafe(): void {
    const telemetry = getLastTelemetry()
    if (!telemetry || !isTelemetryFresh() || telemetry.ok === false || !isValidUltrasonicCm(telemetry.tankDistanceCm)) {
      this.desiredPumpOn = false
      forcePumpOff()
    }
  }

  /**
   * Advances Zone B's simulated soil (not copied from Zone A) and estimates
   * Water USED from configured zone rates while the real pump is on.
   * Water IN stays 0 until a flow or rain sensor is actually wired.
   */
  accountTick(elapsedMinutes: number): void {
    this.ingestLatestTelemetry()
    this.applyPhysicalFailsafe()

    const zoneB = this.zones.get(ZONE_B)
    if (zoneB && !isPinAssigned(UNASSIGNED_GPIO.SECOND_SOIL_PIN)) {
      const dryingRate = 0.03
      const jitter = (Math.random() - 0.5) * 0.3
      zoneB.soilMoisturePct = clamp(zoneB.soilMoisturePct - dryingRate * elapsedMinutes + jitter, 10, 95)
      zoneB.soilAsOf = nowIso()
      zoneB.soilTag = 'simulated'
      zoneB.soilValid = true
    }

    const telemetry = getLastTelemetry()
    const pumpActuallyOn = Boolean(telemetry && isTelemetryFresh() && telemetry.pumpIsOn)
    let waterUsedL = 0
    for (const cfg of this.zoneConfigById.values()) {
      const zone = this.zones.get(cfg.id)
      if (!zone?.active || !pumpActuallyOn) continue
      const used = cfg.nominalOutflowRateLPerMin * elapsedMinutes
      waterUsedL += used
      zone.lastWateredAt = nowIso()
      this.cumulativeUsedByZoneL.set(cfg.id, (this.cumulativeUsedByZoneL.get(cfg.id) ?? 0) + used)
    }

    this.cumulativeUsedL += waterUsedL
    this.rollingConsumption = recordConsumption(this.rollingConsumption, waterUsedL, elapsedMinutes)
    this.lastWaterUsedLPerMin = elapsedMinutes > 0 ? waterUsedL / elapsedMinutes : 0
    this.lastWaterInLPerMin = 0
  }

  async getTankLevel(): Promise<TankState> {
    this.ingestLatestTelemetry()
    const telemetry = getLastTelemetry()
    const calibration = getHardwareCalibration()
    const capacityL = getTankConfig().capacityL
    if (!telemetry) {
      return { levelL: { value: 0, tag: 'measured', asOf: NEVER_AS_OF } }
    }
    const litres = tankDistanceToLitres(telemetry.tankDistanceCm, calibration, capacityL)
    if (litres === null || !isTelemetryFresh()) {
      return { levelL: { value: 0, tag: 'measured', asOf: isoFromMs(telemetry.receivedAt) } }
    }
    return { levelL: { value: litres, tag: 'measured', asOf: isoFromMs(telemetry.receivedAt) } }
  }

  async getSources(): Promise<WaterSource[]> {
    const asOf = nowIso()
    return WATER_SOURCE_CONFIGS.map((cfg) => {
      const state = this.sources.get(cfg.id)!
      return {
        ...cfg,
        state: {
          id: cfg.id,
          currentL: {
            value: cfg.hasOwnStorage ? state.currentL : 0,
            tag: 'simulated',
            asOf,
          },
          active: state.active,
        },
      }
    })
  }

  async getZones(): Promise<IrrigationZone[]> {
    this.ingestLatestTelemetry()
    return [...this.zoneConfigById.values()].map((cfg) => {
      const state = this.zones.get(cfg.id)
      const crop = this.cropById.get(cfg.cropId)
      if (!crop) throw new Error(`Unknown crop for zone ${cfg.id}`)
      if (!state) throw new Error(`Unknown zone state ${cfg.id}`)
      return {
        ...cfg,
        crop,
        state: {
          id: cfg.id,
          soilMoisturePct: {
            value: state.soilValid ? state.soilMoisturePct : Number.NaN,
            tag: state.soilTag,
            asOf: state.soilAsOf,
          },
          active: state.active,
          lastWateredAt: state.lastWateredAt,
        },
      }
    })
  }

  async getZoneConfig(zoneId: string): Promise<IrrigationZoneConfig | undefined> {
    const cfg = this.zoneConfigById.get(zoneId)
    return cfg ? { ...cfg } : undefined
  }

  updateZoneConfig(next: IrrigationZoneConfig): void {
    this.zoneConfigById.set(next.id, { ...next })
  }

  resetZoneConfig(zoneId: string): boolean {
    const seed = IRRIGATION_ZONE_CONFIGS.find((c) => c.id === zoneId)
    if (!seed) return false
    this.zoneConfigById.set(zoneId, { ...seed })
    return true
  }

  async getRainStatus(): Promise<RainStatusReading> {
    this.ingestLatestTelemetry()
    const telemetry = getLastTelemetry()
    if (telemetry && isPinAssigned(UNASSIGNED_GPIO.RAIN_SENSOR_PIN) && telemetry.rainIsWet !== null) {
      return {
        isRaining: {
          value: telemetry.rainIsWet,
          tag: 'measured',
          asOf: isoFromMs(telemetry.receivedAt),
        },
      }
    }
    return { isRaining: { value: false, tag: 'simulated', asOf: nowIso() } }
  }

  async getPumpStatus(): Promise<PumpStateReading> {
    const telemetry = getLastTelemetry()
    if (telemetry && isTelemetryFresh()) {
      return { isOn: { value: telemetry.pumpIsOn, tag: 'measured', asOf: isoFromMs(telemetry.receivedAt) } }
    }
    if (telemetry) {
      return { isOn: { value: telemetry.pumpIsOn, tag: 'measured', asOf: isoFromMs(telemetry.receivedAt) } }
    }
    return { isOn: { value: this.desiredPumpOn, tag: 'estimated', asOf: nowIso() } }
  }

  async getOperationMode(): Promise<OperationMode> {
    return this.operationMode
  }

  async getSystemStatus(): Promise<SystemStatusReading> {
    const tank = await this.getTankLevel()
    const tankConfig = getTankConfig()
    const anyZoneActive = [...this.zones.values()].some((z) => z.active)
    const allZonesSufficient = [...this.zoneConfigById.values()].every((cfg) => {
      const state = this.zones.get(cfg.id)
      const crop = this.cropById.get(cfg.cropId)
      if (!crop || !state?.soilValid) return false
      const { minPct } = moistureTargetsForZone({ ...cfg, crop })
      return state.soilMoisturePct > minPct
    })
    const rain = await this.getRainStatus()
    const phase: SystemStatusReading['phase'] = anyZoneActive
      ? 'irrigating'
      : rain.isRaining.value
        ? 'rain-detected'
        : tank.levelL.value / tankConfig.capacityL < tankConfig.criticalThresholdPct / 100
          ? 'low-water'
          : allZonesSufficient
            ? 'soil-moisture-sufficient'
            : 'waiting'
    return { phase, operationMode: this.operationMode }
  }

  async setPumpState(isOn: boolean): Promise<void> {
    if (!isOn) {
      this.desiredPumpOn = false
      forcePumpOff()
      return
    }
    const telemetry = getLastTelemetry()
    if (
      !telemetry ||
      !isTelemetryFresh() ||
      telemetry.ok === false ||
      !isValidUltrasonicCm(telemetry.tankDistanceCm)
    ) {
      this.desiredPumpOn = false
      forcePumpOff()
      return
    }
    this.desiredPumpOn = true
    setPumpCommand(true)
  }

  async setZoneValve(zoneId: string, isOn: boolean): Promise<void> {
    const zone = this.zones.get(zoneId)
    if (!zone) throw new Error(`Unknown zone: ${zoneId}`)
    zone.active = isOn
    setValveCommand(zoneId, isOn)
  }

  async setOperationMode(mode: OperationMode): Promise<void> {
    this.operationMode = mode
  }

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

  getCumulativeUsedByZoneL(zoneId: string): number {
    return this.cumulativeUsedByZoneL.get(zoneId) ?? 0
  }

  getLastTickRatesLPerMin(): { waterInLPerMin: number; waterUsedLPerMin: number } {
    return { waterInLPerMin: this.lastWaterInLPerMin, waterUsedLPerMin: this.lastWaterUsedLPerMin }
  }

  getFlowInputSource() {
    return ACTIVE_FLOW_INPUT_SOURCE
  }

  /** Test isolation. */
  resetForTests(): void {
    this.operationMode = 'auto'
    this.desiredPumpOn = false
    this.sources = new Map(WATER_SOURCE_CONFIGS.map((cfg) => [cfg.id, { ...INITIAL_SOURCE_STATE[cfg.id] }]))
    this.zoneConfigById = copyZoneConfigs()
    this.zones.get(ZONE_A)!.soilMoisturePct = 0
    this.zones.get(ZONE_A)!.soilAsOf = NEVER_AS_OF
    this.zones.get(ZONE_A)!.soilValid = false
    this.zones.get(ZONE_A)!.active = false
    this.zones.get(ZONE_A)!.lastWateredAt = null
    this.zones.get(ZONE_B)!.soilMoisturePct = INITIAL_ZONE_MOISTURE_PCT[ZONE_B] ?? 52
    this.zones.get(ZONE_B)!.soilAsOf = nowIso()
    this.zones.get(ZONE_B)!.soilTag = 'simulated'
    this.zones.get(ZONE_B)!.soilValid = true
    this.zones.get(ZONE_B)!.active = false
    this.zones.get(ZONE_B)!.lastWateredAt = null
    this.cumulativeInflowL = 0
    this.cumulativeUsedL = 0
    this.lastWaterInLPerMin = 0
    this.lastWaterUsedLPerMin = 0
    this.rollingConsumption = emptyRollingWindow()
    this.cumulativeUsedByZoneL = new Map(IRRIGATION_ZONE_CONFIGS.map((cfg) => [cfg.id, 0]))
  }
}
