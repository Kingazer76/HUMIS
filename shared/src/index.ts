/**
 * Domain types shared between the AquaFlow client and server.
 *
 * The most important rule encoded here: AquaFlow has a tank-level sensor
 * but no flow sensor. Every numeric reading that isn't a direct tank-level
 * measurement MUST carry a `DataTag` so the UI can never present an
 * estimate as if it were physically measured.
 */

/** How a value was obtained. Never omit this when returning a reading to the UI. */
export type DataTag = 'measured' | 'estimated' | 'simulated' | 'forecast'

/**
 * The seam that lets a real flow sensor replace the rate x duration estimate
 * later without redesigning `waterAccounting`. Everything is
 * 'configured-rate' until a real flow sensor (Phase 7+) exists.
 */
export type FlowInputSource = 'configured-rate' | 'flow-sensor'

/** A value plus how it was obtained and when. */
export interface Tagged<T> {
  value: T
  tag: DataTag
  /** Only set when the reading is a flow estimate (Water In / Water Used). */
  flowInputSource?: FlowInputSource
  /** ISO timestamp of when this value was produced. */
  asOf: string
}

export type OperationMode = 'auto' | 'manual'

export type WaterSourceKind = 'rainwater' | 'well' | 'reservoir' | 'manual'

export interface WaterSourceConfig {
  id: string
  name: string
  kind: WaterSourceKind
  capacityL: number
  /** Nominal transfer-into-tank rate (L/min) while this source is active. */
  nominalTransferRateLPerMin: number
}

export interface WaterSourceState {
  id: string
  /** Simulated now; will be `measured` once a real level sensor exists for this source. */
  currentL: Tagged<number>
  /** Whether this source is currently enabled to transfer into the main tank. */
  active: boolean
}

export type WaterSource = WaterSourceConfig & { state: WaterSourceState }

export type IrrigationPriority = 'low' | 'medium' | 'high'

export interface CropProfile {
  id: string
  name: string
  defaultMinMoisturePct: number
  defaultMaxMoisturePct: number
  priority: IrrigationPriority
}

export type SoilMoistureSensorMode = 'default' | 'custom'
export type IrrigationPreference = 'standard' | 'water-saving' | 'aggressive'

export interface IrrigationZoneConfig {
  id: string
  name: string
  cropId: string
  sensorMode: SoilMoistureSensorMode
  irrigationPreference: IrrigationPreference
  /** Overrides the crop's default min/max moisture target when set. */
  overrideMinPct?: number
  overrideMaxPct?: number
  /** Nominal outflow-from-tank rate (L/min) while this zone is actively irrigating. */
  nominalOutflowRateLPerMin: number
}

/**
 * Effective soil-moisture start/stop band for a zone: crop defaults, then
 * optional overrides, then the watering-style shift (save water / extra).
 * Used by the irrigation engine and by the Irrigation tab so both agree.
 */
export function moistureTargetsForZone(zone: {
  irrigationPreference: IrrigationPreference
  overrideMinPct?: number
  overrideMaxPct?: number
  crop: Pick<CropProfile, 'defaultMinMoisturePct' | 'defaultMaxMoisturePct'>
}): { minPct: number; maxPct: number } {
  const baseMin = zone.overrideMinPct ?? zone.crop.defaultMinMoisturePct
  const baseMax = zone.overrideMaxPct ?? zone.crop.defaultMaxMoisturePct
  let minPct = baseMin
  let maxPct = baseMax
  if (zone.irrigationPreference === 'water-saving') {
    minPct = baseMin - 5
    maxPct = baseMax - 5
  } else if (zone.irrigationPreference === 'aggressive') {
    minPct = baseMin + 5
    maxPct = baseMax + 5
  }
  minPct = Math.min(99, Math.max(0, minPct))
  maxPct = Math.min(100, Math.max(minPct + 1, maxPct))
  return { minPct, maxPct }
}

export interface IrrigationZoneState {
  id: string
  soilMoisturePct: Tagged<number>
  /** Whether the zone's valve is currently open (irrigating). Nothing sets this to true until Phase 3's safety controller exists. */
  active: boolean
  lastWateredAt: string | null
}

export type IrrigationZone = IrrigationZoneConfig & { state: IrrigationZoneState; crop: CropProfile }

export interface TankConfig {
  capacityL: number
  lowThresholdPct: number
  criticalThresholdPct: number
}

export interface TankState {
  /** Simulated now; becomes `measured` once a real HC-SR04 reading feeds ESP32DeviceProvider. */
  levelL: Tagged<number>
}

export interface RainStatusReading {
  isRaining: Tagged<boolean>
}

export interface PumpStateReading {
  isOn: Tagged<boolean>
}

export type SystemStatusPhase =
  | 'irrigating'
  | 'waiting'
  | 'rain-detected'
  | 'low-water'
  | 'soil-moisture-sufficient'

export interface SystemStatusReading {
  phase: SystemStatusPhase
  operationMode: OperationMode
}

/** Response shape for GET /api/water — the tank + flow + monitoring numbers. */
export interface WaterSnapshot {
  tank: TankConfig & { state: TankState }
  mainTankL: Tagged<number>
  transferableSourceL: Tagged<number>
  totalAvailableL: Tagged<number>
  waterInLPerMin: Tagged<number>
  waterUsedLPerMin: Tagged<number>
  inflowSinceStartL: Tagged<number>
  usedSinceStartL: Tagged<number>
}

/** Response shape for GET /api/system — read-only sensor/actuator status. */
export interface SystemSnapshot {
  rain: RainStatusReading
  pump: PumpStateReading
  system: SystemStatusReading
}

/**
 * Response shape for every POST /api/irrigation/* action. `ok: false` means
 * `safetyController` rejected the action (e.g. critical tank level, stale
 * reading, debounce) — this is a normal, expected outcome, not a server
 * error, and the UI should show `reason` rather than treat it as a failure.
 */
export interface IrrigationActionResult {
  ok: boolean
  reason: string
  zone?: IrrigationZone
}

export type ShortageTier = 'low' | 'moderate' | 'high' | 'critical'

/**
 * Response shape for GET /api/planning. `daysRemaining` is tagged
 * `forecast` (it's a projection, not a measurement or even a direct
 * estimate). `weatherApplied` tells the UI whether the weather provider was
 * reachable for this calculation — `false` is a normal, safe outcome, not
 * an error; the prediction is always valid either way.
 *
 * `sevenDayAverageConsumptionL` is the unadjusted rolling average (up to
 * 7 simulated days of observed usage). `adjustedDailyConsumptionL` is that
 * same figure after the optional weather multiplier.
 */
export interface PlanningSnapshot {
  daysRemaining: Tagged<number>
  tier: ShortageTier
  reason: string
  sevenDayAverageConsumptionL: Tagged<number>
  adjustedDailyConsumptionL: Tagged<number>
  weatherApplied: boolean
  /** How many simulated days of usage the 7-day average was computed over (0–7, may be fractional). */
  observedDays: number
}

export type HistoryRecordKind = 'irrigation-event' | 'farm-snapshot'
export type SoilCondition = 'dry' | 'healthy' | 'wet'
export type WateringAction = 'started' | 'stopped' | 'watering' | 'idle'

/**
 * One row in GET /api/history. Farmer-facing fields are the names, soil
 * condition, watering action, water used, and when it happened. `id`,
 * `kind`, `zoneId`, and `tankLevelL` are kept for tests and later work —
 * the History tab does not show them as primary columns.
 */
export interface HistoryRecord {
  id: string
  recordedAt: string
  kind: HistoryRecordKind
  tag: DataTag
  zoneId: string
  zoneName: string
  cropName: string
  soilMoisturePct: number
  soilCondition: SoilCondition
  wateringAction: WateringAction
  waterUsedL: number
  tankLevelL: number
}

/** Response shape for GET /api/history. Newest record first. */
export interface HistorySnapshot {
  records: HistoryRecord[]
}

/**
 * Response shape for GET /api/settings. Tank numbers and zone configs are
 * the live farm settings (in-memory while the server is running).
 */
export interface SettingsSnapshot {
  tank: TankConfig
  tankDefaults: TankConfig
  zones: IrrigationZone[]
  crops: CropProfile[]
}

/**
 * Response shape for every settings write. `ok: false` means the change
 * was rejected (invalid numbers) and nothing was saved — a normal outcome,
 * not a server crash.
 */
export interface SettingsActionResult {
  ok: boolean
  reason: string
  tank?: TankConfig
  zone?: IrrigationZoneConfig
}

/** Response shape for POST /api/assistant/chat. */
export interface AssistantChatResponse {
  reply: string
  /** Present when the message asked to start/stop watering or the pump. */
  action?: IrrigationActionResult
}

/** Response shape for POST /api/assistant/speech. `ok: false` means try again — never a guessed transcript. */
export interface SpeechToTextResponse {
  ok: boolean
  text?: string
  reason?: string
}

export const AQUAFLOW_SHARED_VERSION = '0.6.0'
