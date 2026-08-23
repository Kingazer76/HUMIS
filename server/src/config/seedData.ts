import type {
  CropProfile,
  IrrigationZoneConfig,
  TankConfig,
  WaterSourceConfig,
} from '@aquaflow/shared'

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

export const INITIAL_TANK_LEVEL_L = 9700

export const WATER_SOURCE_CONFIGS: WaterSourceConfig[] = [
  {
    id: 'rainwater-harvesting',
    name: 'Rainwater Harvesting',
    kind: 'rainwater',
    capacityL: 5000,
    nominalTransferRateLPerMin: 1.2,
  },
  {
    id: 'well-borehole',
    name: 'Well / Borehole',
    kind: 'well',
    capacityL: 10000,
    nominalTransferRateLPerMin: 1.8,
  },
  {
    id: 'reservoir-pond',
    name: 'Reservoir / Pond',
    kind: 'reservoir',
    capacityL: 8000,
    nominalTransferRateLPerMin: 1.0,
  },
  {
    id: 'manual-supply',
    name: 'Manual Supply',
    kind: 'manual',
    capacityL: 2000,
    nominalTransferRateLPerMin: 0,
  },
]

/** Initial fill level (L) and whether each source auto-transfers into the tank. */
export const INITIAL_SOURCE_STATE: Record<string, { currentL: number; active: boolean }> = {
  'rainwater-harvesting': { currentL: 2900, active: true },
  'well-borehole': { currentL: 6100, active: true },
  'reservoir-pond': { currentL: 4100, active: false },
  'manual-supply': { currentL: 1000, active: false },
}

export const CROP_PROFILES: CropProfile[] = [
  { id: 'maize', name: 'Maize', defaultMinMoisturePct: 40, defaultMaxMoisturePct: 60, priority: 'medium' },
  { id: 'tomato', name: 'Tomato', defaultMinMoisturePct: 50, defaultMaxMoisturePct: 70, priority: 'high' },
]

export const IRRIGATION_ZONE_CONFIGS: IrrigationZoneConfig[] = [
  {
    id: 'zone-a',
    name: 'Zone A — North Field',
    cropId: 'maize',
    sensorMode: 'default',
    irrigationPreference: 'standard',
    nominalOutflowRateLPerMin: 5,
  },
  {
    id: 'zone-b',
    name: 'Zone B — South Field',
    cropId: 'tomato',
    sensorMode: 'default',
    irrigationPreference: 'standard',
    nominalOutflowRateLPerMin: 4,
  },
]

export const INITIAL_ZONE_MOISTURE_PCT: Record<string, number> = {
  'zone-a': 41,
  'zone-b': 52,
}
