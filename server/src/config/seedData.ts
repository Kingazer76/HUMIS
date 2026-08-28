import type {
  FarmLocation,
  IrrigationZoneConfig,
  TankConfig,
  WaterSourceConfig,
} from '@aquaflow/shared'

export { CROP_PROFILES } from '../agronomy/cropCatalog.js'

/**
 * Prototype seed data. Numbers loosely mirror the V1 prototype's own demo
 * state (15,000 L tank, four water sources, two crop zones) so the rebuilt
 * UI reads the same as the original at a glance.
 */

export const TANK_CONFIG: TankConfig = {
  capacityL: 15000,
  lowThresholdPct: 25,
  criticalThresholdPct: 15,
}

/**
 * Default farm place used by the weather forecast. Settings can change
 * this; the Open-Meteo client never bakes in its own city.
 */
export const FARM_LOCATION: FarmLocation = {
  latitude: 6.6885,
  longitude: -1.6244,
  label: 'Kumasi, Ghana',
}

export const INITIAL_TANK_LEVEL_L = 9700

/**
 * Simulated rain-into-main-tank rate while the farm rain sensor is on.
 * Estimated from configured rate × time — not a new flow sensor.
 */
export const RAINWATER_INFLOW_L_PER_MIN = 2.5

export const WATER_SOURCE_CONFIGS: WaterSourceConfig[] = [
  {
    id: 'rainwater-harvesting',
    name: 'Rainwater',
    kind: 'rainwater',
    capacityL: 0,
    hasOwnStorage: false,
    nominalTransferRateLPerMin: RAINWATER_INFLOW_L_PER_MIN,
  },
  {
    id: 'well-borehole',
    name: 'Well / Borehole',
    kind: 'well',
    capacityL: 10000,
    hasOwnStorage: true,
    nominalTransferRateLPerMin: 1.8,
  },
  {
    id: 'reservoir-pond',
    name: 'Reservoir / Pond',
    kind: 'reservoir',
    capacityL: 8000,
    hasOwnStorage: true,
    nominalTransferRateLPerMin: 1.0,
  },
  {
    id: 'manual-supply',
    name: 'Manual Supply',
    kind: 'manual',
    capacityL: 2000,
    hasOwnStorage: true,
    nominalTransferRateLPerMin: 0,
  },
]

/** Initial fill level (L) and whether each source auto-transfers into the tank. */
export const INITIAL_SOURCE_STATE: Record<string, { currentL: number; active: boolean }> = {
  'rainwater-harvesting': { currentL: 0, active: true },
  'well-borehole': { currentL: 6100, active: true },
  'reservoir-pond': { currentL: 4100, active: false },
  'manual-supply': { currentL: 1000, active: false },
}

export const IRRIGATION_ZONE_CONFIGS: IrrigationZoneConfig[] = [
  {
    id: 'zone-a',
    name: 'Zone A — North Field',
    cropId: 'maize',
    sensorMode: 'default',
    irrigationPreference: 'standard',
    nominalOutflowRateLPerMin: 5,
    soilId: 'loam',
    growthStageId: 'mid',
  },
  {
    id: 'zone-b',
    name: 'Zone B — South Field',
    cropId: 'tomato',
    sensorMode: 'default',
    irrigationPreference: 'standard',
    nominalOutflowRateLPerMin: 4,
    soilId: 'loam',
    growthStageId: 'mid',
  },
]

export const INITIAL_ZONE_MOISTURE_PCT: Record<string, number> = {
  'zone-a': 41,
  'zone-b': 52,
}
