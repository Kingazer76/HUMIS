/**
 * Crop/soil water numbers used to turn a soil-moisture sensor reading into
 * an irrigation trigger. Field capacity, wilting point and depletion
 * fraction `p` follow FAO Irrigation and Drainage Paper 56. Mapping the
 * farm's 0–100 sensor onto those volumes is an explicit AquaFlow
 * assumption (the simulated probe is not a calibrated volumetric sensor).
 */

export type AgronomySource = 'fao-56' | 'assumption'

export type SoilId = 'sand' | 'sandy-loam' | 'loam' | 'silt-loam' | 'clay-loam' | 'clay'

export type CropCategory =
  | 'cereal'
  | 'root'
  | 'vegetable'
  | 'legume'
  | 'fruit'
  | 'cash'
  | 'leafy'
  | 'spice'

export type DroughtSensitivity = 'low' | 'moderate' | 'high'

export interface SoilType {
  id: SoilId
  name: string
  /** Volumetric water content at field capacity (m³/m³). FAO-56 Table 19 midpoint. */
  fieldCapacity: number
  /** Volumetric water content at permanent wilting point (m³/m³). FAO-56 Table 19 midpoint. */
  wiltingPoint: number
  /** Total available water in mm per metre of rooting depth. FAO-56 Table 19 midpoint. */
  tawMmPerM: number
  drainage: 'fast' | 'moderate' | 'slow'
  notes: string
  sources: string[]
  assumptions: string[]
}

export interface CropGrowthStage {
  id: string
  name: string
  /** Single crop coefficient Kc for this stage. */
  kc: number
  kcSource: AgronomySource
}

/**
 * How the 0–100 simulated capacitive reading is turned into estimated
 * volumetric water content. Not a laboratory calibration.
 */
export const SENSOR_SATURATION_ABOVE_FC = 0.08

export const SOIL_CATALOG: SoilType[] = [
  {
    id: 'sand',
    name: 'Sandy',
    fieldCapacity: 0.12,
    wiltingPoint: 0.05,
    tawMmPerM: 70,
    drainage: 'fast',
    notes: 'Drains quickly. The same sensor % is wetter than it would be in clay.',
    sources: ['FAO Irrigation and Drainage Paper 56, Table 19 (sand)'],
    assumptions: [
      'Midpoint of the FAO-56 sand range. Sensor-to-volume mapping is an AquaFlow assumption.',
    ],
  },
  {
    id: 'sandy-loam',
    name: 'Sandy loam',
    fieldCapacity: 0.18,
    wiltingPoint: 0.08,
    tawMmPerM: 100,
    drainage: 'fast',
    notes: 'Holds a little more water than sand, still drains fairly quickly.',
    sources: ['FAO Irrigation and Drainage Paper 56, Table 19 (sandy loam)'],
    assumptions: ['Midpoint of the FAO-56 sandy loam range.'],
  },
  {
    id: 'loam',
    name: 'Loam',
    fieldCapacity: 0.27,
    wiltingPoint: 0.12,
    tawMmPerM: 150,
    drainage: 'moderate',
    notes: 'Balanced holding and drainage. Default soil when a field has not been set.',
    sources: ['FAO Irrigation and Drainage Paper 56, Table 19 (loam)'],
    assumptions: ['Midpoint of the FAO-56 loam range.'],
  },
  {
    id: 'silt-loam',
    name: 'Silt loam',
    fieldCapacity: 0.31,
    wiltingPoint: 0.15,
    tawMmPerM: 160,
    drainage: 'moderate',
    notes: 'Holds more plant-available water than loam.',
    sources: ['FAO Irrigation and Drainage Paper 56, Table 19 (silt loam)'],
    assumptions: ['Midpoint of the FAO-56 silt loam range.'],
  },
  {
    id: 'clay-loam',
    name: 'Clay loam',
    fieldCapacity: 0.32,
    wiltingPoint: 0.18,
    tawMmPerM: 140,
    drainage: 'slow',
    notes: 'Holds water tightly. The same sensor % is drier for the plant than in sand.',
    sources: ['FAO Irrigation and Drainage Paper 56, Table 19 (clay loam)'],
    assumptions: ['Midpoint of the FAO-56 clay loam range.'],
  },
  {
    id: 'clay',
    name: 'Clay',
    fieldCapacity: 0.36,
    wiltingPoint: 0.22,
    tawMmPerM: 140,
    drainage: 'slow',
    notes: 'Slow drainage. Easy to over-water.',
    sources: ['FAO Irrigation and Drainage Paper 56, Table 19 (clay)'],
    assumptions: ['Midpoint of the FAO-56 clay range.'],
  },
]

export function getSoil(id: string | undefined): SoilType {
  return SOIL_CATALOG.find((s) => s.id === id) ?? SOIL_CATALOG.find((s) => s.id === 'loam')!
}

export function saturationVwc(soil: SoilType): number {
  return Math.min(0.48, soil.fieldCapacity + SENSOR_SATURATION_ABOVE_FC)
}

export function sensorPctToVwc(sensorPct: number, soil: SoilType): number {
  const sat = saturationVwc(soil)
  const t = Math.min(1, Math.max(0, sensorPct / 100))
  return soil.wiltingPoint + t * (sat - soil.wiltingPoint)
}

export function vwcToSensorPct(vwc: number, soil: SoilType): number {
  const sat = saturationVwc(soil)
  const span = sat - soil.wiltingPoint
  if (span <= 0) return 0
  return Math.min(100, Math.max(0, (100 * (vwc - soil.wiltingPoint)) / span))
}

export interface AgronomicCropInput {
  depletionFractionP: { value: number; source: AgronomySource }
  stages: CropGrowthStage[]
  droughtSensitivity?: DroughtSensitivity
}

/**
 * FAO-56 RAW trigger: irrigate when depletion reaches p × TAW.
 * Stop (refill target) is field capacity.
 * High Kc slightly lowers p (crop using water faster) — FAO-56 allows
 * adjusting p with ETc; Kc is used here as a stand-in when ETo is missing.
 */
export function agronomicSensorBand(
  crop: AgronomicCropInput,
  soil: SoilType,
  stageId: string | undefined,
): { minPct: number; maxPct: number; kc: number; p: number; stage: CropGrowthStage } {
  const stage =
    crop.stages.find((s) => s.id === stageId) ??
    crop.stages.find((s) => s.id === 'mid') ??
    crop.stages[0]!
  let p = crop.depletionFractionP.value
  if (stage.kc >= 1.15) p = Math.max(0.2, p - 0.05)
  if (crop.droughtSensitivity === 'high') p = Math.max(0.2, p - 0.05)
  if (crop.droughtSensitivity === 'low') p = Math.min(0.8, p + 0.05)
  const taw = soil.fieldCapacity - soil.wiltingPoint
  const triggerVwc = soil.fieldCapacity - p * taw
  const minPct = Math.round(vwcToSensorPct(triggerVwc, soil))
  const maxPct = Math.round(vwcToSensorPct(soil.fieldCapacity, soil))
  return {
    minPct: Math.min(98, Math.max(1, minPct)),
    maxPct: Math.min(99, Math.max(minPct + 1, maxPct)),
    kc: stage.kc,
    p,
    stage,
  }
}
