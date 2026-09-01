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
  /**
   * Own-tank size in litres. Unused when `hasOwnStorage` is false — that
   * source has no tank of its own and only feeds the main tank.
   */
  capacityL: number
  /**
   * When false, this source is an inflow into the main tank (rainwater).
   * It must not be counted as a separate stored reserve.
   */
  hasOwnStorage: boolean
  /** Nominal transfer-into-tank rate (L/min) while this source is active. */
  nominalTransferRateLPerMin: number
}

export interface WaterSourceState {
  id: string
  /**
   * Litres sitting in this source's own tank. Always 0 when the source has
   * no independent storage (rainwater feeds the main tank directly).
   */
  currentL: Tagged<number>
  /** Whether this source is currently enabled to transfer into the main tank. */
  active: boolean
  /**
   * Estimated L/min this source added to the main tank on the last tick.
   * Used so the Water tab can show rain contributing without a second tank.
   */
  lastInflowLPerMin?: Tagged<number>
}

export type WaterSource = WaterSourceConfig & { state: WaterSourceState }

export type IrrigationPriority = 'low' | 'medium' | 'high'

export type {
  AgronomySource,
  CropCategory,
  CropGrowthStage,
  DroughtSensitivity,
  SoilId,
  SoilType,
} from './agronomy.js'
export {
  SOIL_CATALOG,
  agronomicSensorBand,
  getSoil,
  sensorPctToVwc,
  vwcToSensorPct,
} from './agronomy.js'

import { agronomicSensorBand, getSoil, type AgronomySource, type CropGrowthStage, type CropCategory, type DroughtSensitivity, type SoilId, type SoilType } from './agronomy.js'

export interface CropProfile {
  id: string
  name: string
  defaultMinMoisturePct: number
  defaultMaxMoisturePct: number
  priority: IrrigationPriority
  category?: CropCategory
  stages?: CropGrowthStage[]
  rootingDepthM?: { min: number; max: number; source: AgronomySource }
  depletionFractionP?: { value: number; source: AgronomySource }
  droughtSensitivity?: DroughtSensitivity
  preferredMoisture?: string
  irrigationNotes?: string
  sources?: string[]
  assumptions?: string[]
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
  /** Soil on this field. Used to interpret the soil-moisture sensor. */
  soilId?: SoilId
  /** Current crop growth stage id from the crop's `stages` list. */
  growthStageId?: string
}

/**
 * Effective soil-moisture start/stop band for a zone.
 * When the crop has FAO-style Kc/p numbers and the field has a soil type,
 * the band is derived from crop + soil + growth stage. Manual overrides
 * still win. Watering style (save water / extra) still shifts the band.
 */
export function moistureTargetsForZone(zone: {
  irrigationPreference: IrrigationPreference
  overrideMinPct?: number
  overrideMaxPct?: number
  soilId?: SoilId
  growthStageId?: string
  crop: Pick<
    CropProfile,
    'defaultMinMoisturePct' | 'defaultMaxMoisturePct' | 'depletionFractionP' | 'stages' | 'droughtSensitivity'
  >
}): { minPct: number; maxPct: number } {
  let baseMin = zone.overrideMinPct ?? zone.crop.defaultMinMoisturePct
  let baseMax = zone.overrideMaxPct ?? zone.crop.defaultMaxMoisturePct
  if (
    zone.overrideMinPct === undefined &&
    zone.overrideMaxPct === undefined &&
    zone.crop.depletionFractionP &&
    zone.crop.stages &&
    zone.crop.stages.length > 0
  ) {
    const band = agronomicSensorBand(
      {
        depletionFractionP: zone.crop.depletionFractionP,
        stages: zone.crop.stages,
        droughtSensitivity: zone.crop.droughtSensitivity,
      },
      getSoil(zone.soilId),
      zone.growthStageId,
    )
    baseMin = band.minPct
    baseMax = band.maxPct
  }
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

/**
 * Where the farm sits. The weather provider reads this at request time
 * instead of baking a city into the forecast URL.
 */
export interface FarmLocation {
  latitude: number
  longitude: number
  /** Short place name shown to the farmer, e.g. "Kumasi, Ghana". */
  label: string
}

/** Farmer-facing forecast condition. Matches the existing weather pictures. */
export type WeatherCondition = 'clear' | 'rain' | 'hot-dry'

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
  /** Own-storage source reserves. Shown on the Water tab. Not part of Available Water. */
  transferableSourceL: Tagged<number>
  /** Currently available stored water — the main tank only, clamped to capacity. */
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

export type IrrigationAdviceStatus =
  | 'no-irrigation-needed'
  | 'monitor'
  | 'irrigation-recommended'
  | 'irrigation-urgent'
  | 'irrigation-limited-by-water'

export interface ZoneIrrigationAdvice {
  zoneId: string
  zoneName: string
  status: IrrigationAdviceStatus
  reason: string
  cropName: string
  soilName: string
  growthStageName: string
  moisturePct: number
  triggerPct: number
  stopPct: number
  kc: number
  estimatedNeedL: number
  estimatedDurationMin: number
  availableTankL: number
  nextCheckHours: number
  weatherApplied: boolean
  /** Same two flow channels as Water IN / Water USED. Not a new sensor. */
  flowInputSource: FlowInputSource
}

export interface IrrigationAdviceSnapshot {
  zones: ZoneIrrigationAdvice[]
}

export type ShortageTier = 'low' | 'moderate' | 'high' | 'critical'

/** One day in the weather forecast shown on Planning. */
export interface WeatherDayForecast {
  date: string
  condition: WeatherCondition
  temperatureMaxC: Tagged<number>
  temperatureMinC: Tagged<number>
  precipitationMm: Tagged<number>
  precipitationProbabilityPct: Tagged<number>
}

/**
 * Mapped Open-Meteo (or swapped provider) forecast. `available: false` is
 * a normal outcome — planning still returns days remaining from tank and
 * usage. Forecast numbers are tagged `forecast`.
 */
export interface WeatherForecastSnapshot {
  available: boolean
  reason?: string
  asOf?: string
  location?: FarmLocation
  /** Which weather provider produced this snapshot. Swappable later. */
  source?: string
  condition?: WeatherCondition
  temperatureC?: Tagged<number>
  humidityPct?: Tagged<number>
  precipitationMm?: Tagged<number>
  precipitationProbabilityPct?: Tagged<number>
  expectedRainfallMm?: Tagged<number>
  days?: WeatherDayForecast[]
}

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
  weather: WeatherForecastSnapshot
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
/**
 * Numbers HUMIS uses to turn raw ESP32 readings into tank litres and
 * soil-wetness percent. Empty/full distances are centimetres from the
 * ultrasonic sensor to the water. Soil numbers are the analog reading
 * (ADC) when soil is dry vs soaked. Do not invent tank size here —
 * tank capacity stays in `TankConfig`.
 */
export interface HardwareCalibration {
  /** Distance (cm) when the tank is empty — usually the larger number. */
  tankEmptyDistanceCm: number
  /** Distance (cm) when the tank is full — usually the smaller number. */
  tankFullDistanceCm: number
  /** Analog reading when Zone A soil is dry. */
  soilDryAdc: number
  /** Analog reading when Zone A soil is soaked. */
  soilWetAdc: number
  /**
   * When true, GPIO 26 goes HIGH (3.3V) to turn the pump ON.
   * When false, GPIO 26 goes LOW (0V) to turn the pump ON (active-low relay).
   */
  relayActiveHigh: boolean
  /** Longest the ESP32 may keep the pump on before it turns itself off. */
  maxPumpOnSeconds: number
}

export const DEFAULT_HARDWARE_CALIBRATION: HardwareCalibration = {
  tankEmptyDistanceCm: 100,
  tankFullDistanceCm: 20,
  soilDryAdc: 3000,
  soilWetAdc: 1200,
  relayActiveHigh: true,
  maxPumpOnSeconds: 30,
}

/** Confirmed GPIOs vs pins we have not wired yet. Null means not connected. */
export interface HardwarePinMap {
  ultrasonicTrig: number
  ultrasonicEcho: number
  soilAdcZoneA: number
  pumpRelay: number
  rainSensor: number | null
  flowIn: number | null
  flowOut: number | null
  zoneAValve: number | null
  zoneBValve: number | null
  secondSoil: number | null
}

/** How the ESP32 board is talking to HUMIS right now. */
export interface HardwareLinkStatus {
  /** True while the on-screen farm is still the practice (simulated) farm. */
  useSimulated: boolean
  lastTelemetryAt: string | null
  lastTelemetryAgeMs: number | null
  boardHeard: boolean
  pins: HardwarePinMap
}

export interface SettingsSnapshot {
  tank: TankConfig
  tankDefaults: TankConfig
  location: FarmLocation
  locationDefaults: FarmLocation
  zones: IrrigationZone[]
  crops: CropProfile[]
  soils: SoilType[]
  hardwareCalibration: HardwareCalibration
  hardwareCalibrationDefaults: HardwareCalibration
  hardware: HardwareLinkStatus
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
  location?: FarmLocation
  zone?: IrrigationZoneConfig
  hardwareCalibration?: HardwareCalibration
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

/** JSON error shape for POST /api/assistant/speak. Success returns audio bytes, not this object. */
export interface TextToSpeechErrorResponse {
  ok: false
  reason: string
}

export {
  AUTH_GENERIC_FORGOT_MESSAGE,
  AUTH_GENERIC_LOGIN_ERROR,
  DEFAULT_FARM_ID,
} from './auth.js'
export type { AccountStatus, AuthUserPublic } from './auth.js'

export {
  ASSISTANT_LANGUAGE_OPTIONS,
  ASSISTANT_LANGUAGE_STORAGE_KEY,
  DEFAULT_ASSISTANT_LANGUAGE,
  DEFAULT_KHAYA_LANGUAGE,
  KHAYA_LANGUAGE_CATALOG,
  VOICE_MESSAGES,
  activeAssistantLanguages,
  activeKhayaLanguage,
  assistantLanguageConfig,
  isAssistantLanguageId,
  isRegisteredKhayaLanguage,
  resolveAssistantLanguage,
  resolveKhayaLanguage,
  toFarmerVoiceMessage,
} from './speech.js'
export type { AssistantLanguageConfig, AssistantLanguageId, KhayaLanguageCode } from './speech.js'

export const AQUAFLOW_SHARED_VERSION = '0.9.0'
