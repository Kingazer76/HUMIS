import {
  agronomicSensorBand,
  getSoil,
  type AgronomySource,
  type CropCategory,
  type CropGrowthStage,
  type DroughtSensitivity,
} from '@aquaflow/shared'
import type { CropProfile, IrrigationPriority } from '@aquaflow/shared'

const FAO = 'FAO Irrigation and Drainage Paper 56'
const FAO_KC = `${FAO}, Table 12 (single crop coefficient Kc)`
const FAO_P = `${FAO}, Table 22 (depletion fraction p and rooting depth)`
const GHANA = 'Crop list chosen for common Ghanaian production (cereals, roots, vegetables, legumes, tree crops). Kc/p/Zr still come from FAO-56 or a named analog, not from a Ghana-specific Kc table.'

function stages(
  ini: number,
  mid: number,
  end: number,
  source: AgronomySource,
  labels?: { initial?: string; vegetative?: string; mid?: string; late?: string },
): CropGrowthStage[] {
  return [
    { id: 'initial', name: labels?.initial ?? 'Initial / establishment', kc: ini, kcSource: source },
    { id: 'vegetative', name: labels?.vegetative ?? 'Vegetative', kc: Number(((ini + mid) / 2).toFixed(2)), kcSource: source },
    { id: 'mid', name: labels?.mid ?? 'Mid-season', kc: mid, kcSource: source },
    { id: 'late', name: labels?.late ?? 'Maturity', kc: end, kcSource: source },
  ]
}

interface CropDraft {
  id: string
  name: string
  category: CropCategory
  priority: IrrigationPriority
  kcIni: number
  kcMid: number
  kcEnd: number
  kcSource: AgronomySource
  p: number
  pSource: AgronomySource
  zrMin: number
  zrMax: number
  zrSource: AgronomySource
  droughtSensitivity: DroughtSensitivity
  preferredMoisture: string
  irrigationNotes: string
  analog?: string
  extraAssumptions?: string[]
  stageLabels?: { initial?: string; vegetative?: string; mid?: string; late?: string }
}

function buildCrop(draft: CropDraft): CropProfile {
  const cropStages = stages(draft.kcIni, draft.kcMid, draft.kcEnd, draft.kcSource, draft.stageLabels)
  const agronomy = {
    depletionFractionP: { value: draft.p, source: draft.pSource },
    stages: cropStages,
    droughtSensitivity: draft.droughtSensitivity,
  }
  const band = agronomicSensorBand(agronomy, getSoil('loam'), 'mid')
  const assumptions = [
    ...(draft.kcSource === 'assumption'
      ? [`Kc uses ${draft.analog ?? 'a close FAO-56 analog'} because this crop is not listed on its own in FAO-56 Table 12.`]
      : []),
    ...(draft.pSource === 'assumption'
      ? [`Depletion fraction p uses ${draft.analog ?? 'a close FAO-56 analog'} (FAO-56 Table 22).`]
      : []),
    ...(draft.zrSource === 'assumption'
      ? [`Rooting depth uses ${draft.analog ?? 'a close FAO-56 analog'} (FAO-56 Table 22).`]
      : []),
    'Default moisture band is computed for loam at mid-season, then adjusted per field soil and growth stage.',
    'Vegetative-stage Kc is the midpoint of FAO initial and mid Kc (FAO-56 Table 12 does not publish a separate vegetative Kc).',
    ...(draft.extraAssumptions ?? []),
  ]
  return {
    id: draft.id,
    name: draft.name,
    category: draft.category,
    defaultMinMoisturePct: band.minPct,
    defaultMaxMoisturePct: band.maxPct,
    priority: draft.priority,
    stages: cropStages,
    rootingDepthM: { min: draft.zrMin, max: draft.zrMax, source: draft.zrSource },
    depletionFractionP: { value: draft.p, source: draft.pSource },
    droughtSensitivity: draft.droughtSensitivity,
    preferredMoisture: draft.preferredMoisture,
    irrigationNotes: draft.irrigationNotes,
    sources: [GHANA, ...(draft.kcSource === 'fao-56' ? [FAO_KC] : []), ...(draft.pSource === 'fao-56' || draft.zrSource === 'fao-56' ? [FAO_P] : [])],
    assumptions,
  }
}

/**
 * 54 crops grown in Ghana. Kc, p, and rooting depth are FAO-56 where the
 * crop (or a named analog) appears in Tables 12 and 22. Everything else is
 * labelled assumption.
 */
const DRAFTS: CropDraft[] = [
  { id: 'maize', name: 'Maize', category: 'cereal', priority: 'medium', kcIni: 0.3, kcMid: 1.2, kcEnd: 0.5, kcSource: 'fao-56', p: 0.55, pSource: 'fao-56', zrMin: 1.0, zrMax: 1.7, zrSource: 'fao-56', droughtSensitivity: 'moderate', preferredMoisture: 'Even moisture; do not let the seedbed dry at establishment.', irrigationNotes: 'Peak demand is around tasseling and grain filling (mid-season Kc 1.20).', stageLabels: { mid: 'Flowering / grain filling' } },
  { id: 'rice-paddy', name: 'Rice (paddy)', category: 'cereal', priority: 'high', kcIni: 1.05, kcMid: 1.2, kcEnd: 0.9, kcSource: 'fao-56', p: 0.2, pSource: 'fao-56', zrMin: 0.5, zrMax: 1.0, zrSource: 'fao-56', droughtSensitivity: 'high', preferredMoisture: 'Flooded or near-saturated while ponded.', irrigationNotes: 'Paddy rice uses a small p (0.20). AquaFlow still uses the main tank; it does not model a separate paddy pond.' },
  { id: 'rice-upland', name: 'Rice (upland)', category: 'cereal', priority: 'high', kcIni: 0.5, kcMid: 1.05, kcEnd: 0.7, kcSource: 'assumption', p: 0.45, pSource: 'assumption', zrMin: 0.5, zrMax: 1.0, zrSource: 'fao-56', droughtSensitivity: 'high', preferredMoisture: 'Moist root zone; not flooded.', irrigationNotes: 'Upland rice is not listed separately in FAO-56 Table 12. Kc/p follow a moist cereal analog.', analog: 'rice / cereal analog' },
  { id: 'sorghum', name: 'Sorghum', category: 'cereal', priority: 'medium', kcIni: 0.3, kcMid: 1.0, kcEnd: 0.55, kcSource: 'fao-56', p: 0.55, pSource: 'fao-56', zrMin: 1.0, zrMax: 2.0, zrSource: 'fao-56', droughtSensitivity: 'low', preferredMoisture: 'Can use a larger share of soil water than maize.', irrigationNotes: 'More drought-tolerant than maize (p 0.55, deeper roots).' },
  { id: 'millet', name: 'Pearl millet', category: 'cereal', priority: 'medium', kcIni: 0.3, kcMid: 1.0, kcEnd: 0.3, kcSource: 'fao-56', p: 0.55, pSource: 'fao-56', zrMin: 1.0, zrMax: 2.0, zrSource: 'fao-56', droughtSensitivity: 'low', preferredMoisture: 'Tolerates drier soil than maize once established.', irrigationNotes: 'FAO-56 lists millet with sorghum-like demand.' },
  { id: 'cassava', name: 'Cassava', category: 'root', priority: 'low', kcIni: 0.3, kcMid: 0.8, kcEnd: 0.3, kcSource: 'fao-56', p: 0.45, pSource: 'assumption', zrMin: 0.5, zrMax: 0.8, zrSource: 'assumption', droughtSensitivity: 'low', preferredMoisture: 'Does not need a wet profile once established.', irrigationNotes: 'FAO-56 Table 12 cassava year-1 Kc mid 0.80. p and Zr are not listed for cassava; analog is a moderately drought-tolerant root crop.', analog: 'root crop analog for p and Zr' },
  { id: 'yam', name: 'Yam', category: 'root', priority: 'medium', kcIni: 0.4, kcMid: 1.0, kcEnd: 0.5, kcSource: 'assumption', p: 0.4, pSource: 'assumption', zrMin: 0.5, zrMax: 1.0, zrSource: 'assumption', droughtSensitivity: 'moderate', preferredMoisture: 'Needs moisture while vines and tubers are forming.', irrigationNotes: 'Yam is not in FAO-56 Tables 12/22. Kc/p/Zr follow a root/tuber analog.', analog: 'potato / root analog' },
  { id: 'sweet-potato', name: 'Sweet potato', category: 'root', priority: 'medium', kcIni: 0.5, kcMid: 1.15, kcEnd: 0.65, kcSource: 'assumption', p: 0.35, pSource: 'fao-56', zrMin: 0.4, zrMax: 1.0, zrSource: 'fao-56', droughtSensitivity: 'moderate', preferredMoisture: 'Keep the ridge moist in mid-season.', irrigationNotes: 'Sweet potato is grouped with potato in FAO-56 Table 22 (p 0.35). Kc uses the potato analog.', analog: 'potato' },
  { id: 'cocoyam', name: 'Cocoyam', category: 'root', priority: 'medium', kcIni: 0.5, kcMid: 1.05, kcEnd: 0.7, kcSource: 'assumption', p: 0.35, pSource: 'assumption', zrMin: 0.4, zrMax: 0.8, zrSource: 'assumption', droughtSensitivity: 'high', preferredMoisture: 'Prefers a moist, not waterlogged, profile.', irrigationNotes: 'Cocoyam is not in FAO-56. Kc/p follow a wet-loving tuber analog.', analog: 'taro / potato analog' },
  { id: 'taro', name: 'Taro', category: 'root', priority: 'high', kcIni: 1.0, kcMid: 1.05, kcEnd: 0.95, kcSource: 'fao-56', p: 0.35, pSource: 'assumption', zrMin: 0.3, zrMax: 0.5, zrSource: 'assumption', droughtSensitivity: 'high', preferredMoisture: 'High water use; often grown in wet soils.', irrigationNotes: 'FAO-56 Table 12 lists taro. p/Zr are assumed from a shallow wet tuber.', analog: 'taro Kc from FAO-56; p/Zr assumed' },
  { id: 'tomato', name: 'Tomato', category: 'vegetable', priority: 'high', kcIni: 0.6, kcMid: 1.15, kcEnd: 0.8, kcSource: 'fao-56', p: 0.4, pSource: 'fao-56', zrMin: 0.7, zrMax: 1.5, zrSource: 'fao-56', droughtSensitivity: 'high', preferredMoisture: 'Even moisture; avoid large swings at flowering and fruiting.', irrigationNotes: 'Peak Kc 1.15. p 0.40 means it should be refilled sooner than maize.', stageLabels: { mid: 'Flowering / fruiting' } },
  { id: 'pepper', name: 'Pepper (sweet)', category: 'vegetable', priority: 'high', kcIni: 0.6, kcMid: 1.05, kcEnd: 0.9, kcSource: 'fao-56', p: 0.3, pSource: 'fao-56', zrMin: 0.5, zrMax: 1.0, zrSource: 'fao-56', droughtSensitivity: 'high', preferredMoisture: 'Shallow depletion allowed (p 0.30).', irrigationNotes: 'Peppers are drought-sensitive in FAO-56 Table 22.', stageLabels: { mid: 'Flowering / fruiting' } },
  { id: 'chili', name: 'Chili pepper', category: 'spice', priority: 'high', kcIni: 0.6, kcMid: 1.05, kcEnd: 0.9, kcSource: 'fao-56', p: 0.3, pSource: 'fao-56', zrMin: 0.5, zrMax: 1.0, zrSource: 'fao-56', droughtSensitivity: 'high', preferredMoisture: 'Same FAO pepper group as sweet pepper.', irrigationNotes: 'FAO-56 groups peppers together.', analog: 'pepper' },
  { id: 'onion', name: 'Onion', category: 'vegetable', priority: 'high', kcIni: 0.7, kcMid: 1.05, kcEnd: 0.75, kcSource: 'fao-56', p: 0.3, pSource: 'fao-56', zrMin: 0.3, zrMax: 0.6, zrSource: 'fao-56', droughtSensitivity: 'high', preferredMoisture: 'Shallow roots and small p — refill often.', irrigationNotes: 'Dry-bulb onion in FAO-56. p 0.30, Zr 0.3–0.6 m.' },
  { id: 'shallot', name: 'Shallot', category: 'vegetable', priority: 'high', kcIni: 0.7, kcMid: 1.05, kcEnd: 0.75, kcSource: 'assumption', p: 0.3, pSource: 'fao-56', zrMin: 0.3, zrMax: 0.6, zrSource: 'fao-56', droughtSensitivity: 'high', preferredMoisture: 'Treat like onion.', irrigationNotes: 'Kc assumed from onion. p/Zr from the FAO onion group.', analog: 'onion' },
  { id: 'garlic', name: 'Garlic', category: 'spice', priority: 'high', kcIni: 0.7, kcMid: 1.0, kcEnd: 0.7, kcSource: 'fao-56', p: 0.3, pSource: 'fao-56', zrMin: 0.3, zrMax: 0.5, zrSource: 'fao-56', droughtSensitivity: 'high', preferredMoisture: 'Shallow roots; do not dry the bulb zone.', irrigationNotes: 'FAO-56 lists garlic with onion-like p.' },
  { id: 'okra', name: 'Okra', category: 'vegetable', priority: 'medium', kcIni: 0.5, kcMid: 1.0, kcEnd: 0.9, kcSource: 'assumption', p: 0.4, pSource: 'assumption', zrMin: 0.5, zrMax: 1.0, zrSource: 'assumption', droughtSensitivity: 'moderate', preferredMoisture: 'Moist through flowering and pod set.', irrigationNotes: 'Okra is not in FAO-56 Tables 12/22. Analog is a fruiting vegetable.', analog: 'tomato / pepper analog' },
  { id: 'eggplant', name: 'Eggplant', category: 'vegetable', priority: 'medium', kcIni: 0.6, kcMid: 1.05, kcEnd: 0.9, kcSource: 'fao-56', p: 0.45, pSource: 'fao-56', zrMin: 0.7, zrMax: 1.2, zrSource: 'fao-56', droughtSensitivity: 'moderate', preferredMoisture: 'Even moisture at fruiting.', irrigationNotes: 'FAO-56 eggplant (aubergine).', stageLabels: { mid: 'Flowering / fruiting' } },
  { id: 'garden-egg', name: 'Garden egg', category: 'vegetable', priority: 'medium', kcIni: 0.6, kcMid: 1.05, kcEnd: 0.9, kcSource: 'assumption', p: 0.45, pSource: 'fao-56', zrMin: 0.7, zrMax: 1.2, zrSource: 'fao-56', droughtSensitivity: 'moderate', preferredMoisture: 'Treat like eggplant.', irrigationNotes: 'Garden egg is the Ghanaian eggplant type. FAO eggplant used as analog.', analog: 'eggplant' },
  { id: 'cabbage', name: 'Cabbage', category: 'vegetable', priority: 'high', kcIni: 0.7, kcMid: 1.05, kcEnd: 0.95, kcSource: 'fao-56', p: 0.45, pSource: 'fao-56', zrMin: 0.5, zrMax: 0.8, zrSource: 'fao-56', droughtSensitivity: 'high', preferredMoisture: 'Keep the root zone moist; heads crack if moisture swings.', irrigationNotes: 'FAO-56 cabbage. p 0.45.' },
  { id: 'kale', name: 'Kale', category: 'leafy', priority: 'medium', kcIni: 0.7, kcMid: 1.05, kcEnd: 0.95, kcSource: 'assumption', p: 0.45, pSource: 'fao-56', zrMin: 0.4, zrMax: 0.6, zrSource: 'assumption', droughtSensitivity: 'high', preferredMoisture: 'Leafy brassica — keep moist.', irrigationNotes: 'Kc from cabbage analog. p from FAO cabbage group.', analog: 'cabbage' },
  { id: 'lettuce', name: 'Lettuce', category: 'leafy', priority: 'high', kcIni: 0.7, kcMid: 1.0, kcEnd: 0.95, kcSource: 'fao-56', p: 0.3, pSource: 'fao-56', zrMin: 0.3, zrMax: 0.5, zrSource: 'fao-56', droughtSensitivity: 'high', preferredMoisture: 'Shallow roots and small p — refill often.', irrigationNotes: 'FAO-56 lettuce. p 0.30, Zr 0.3–0.5 m.' },
  { id: 'spinach', name: 'Spinach', category: 'leafy', priority: 'high', kcIni: 0.7, kcMid: 1.0, kcEnd: 0.95, kcSource: 'assumption', p: 0.3, pSource: 'assumption', zrMin: 0.3, zrMax: 0.5, zrSource: 'assumption', droughtSensitivity: 'high', preferredMoisture: 'Shallow leafy crop.', irrigationNotes: 'Spinach Kc/p follow lettuce.', analog: 'lettuce' },
  { id: 'amaranth', name: 'Amaranth (alefu)', category: 'leafy', priority: 'medium', kcIni: 0.6, kcMid: 1.0, kcEnd: 0.9, kcSource: 'assumption', p: 0.4, pSource: 'assumption', zrMin: 0.3, zrMax: 0.6, zrSource: 'assumption', droughtSensitivity: 'moderate', preferredMoisture: 'Keep leaves from wilting; harvest often.', irrigationNotes: 'Not in FAO-56. Leafy-vegetable analog.', analog: 'leafy vegetable analog' },
  { id: 'jute-mallow', name: 'Jute mallow (ayoyo)', category: 'leafy', priority: 'medium', kcIni: 0.6, kcMid: 1.0, kcEnd: 0.9, kcSource: 'assumption', p: 0.4, pSource: 'assumption', zrMin: 0.3, zrMax: 0.6, zrSource: 'assumption', droughtSensitivity: 'moderate', preferredMoisture: 'Moist soil for tender leaves.', irrigationNotes: 'Not in FAO-56. Leafy-vegetable analog.', analog: 'leafy vegetable analog' },
  { id: 'carrot', name: 'Carrot', category: 'vegetable', priority: 'medium', kcIni: 0.7, kcMid: 1.05, kcEnd: 0.95, kcSource: 'fao-56', p: 0.35, pSource: 'fao-56', zrMin: 0.5, zrMax: 1.0, zrSource: 'fao-56', droughtSensitivity: 'moderate', preferredMoisture: 'Even moisture for straight roots.', irrigationNotes: 'FAO-56 carrot.' },
  { id: 'cucumber', name: 'Cucumber', category: 'vegetable', priority: 'high', kcIni: 0.6, kcMid: 1.0, kcEnd: 0.75, kcSource: 'fao-56', p: 0.5, pSource: 'fao-56', zrMin: 0.7, zrMax: 1.2, zrSource: 'fao-56', droughtSensitivity: 'high', preferredMoisture: 'Do not let vines dry at fruiting.', irrigationNotes: 'FAO-56 cucumber. Fresh market.' },
  { id: 'watermelon', name: 'Watermelon', category: 'fruit', priority: 'medium', kcIni: 0.4, kcMid: 1.0, kcEnd: 0.75, kcSource: 'fao-56', p: 0.4, pSource: 'fao-56', zrMin: 0.8, zrMax: 1.5, zrSource: 'fao-56', droughtSensitivity: 'moderate', preferredMoisture: 'Reduce late water to protect sugar if the farm style allows.', irrigationNotes: 'FAO-56 watermelon.' },
  { id: 'groundnut', name: 'Groundnut', category: 'legume', priority: 'medium', kcIni: 0.4, kcMid: 1.15, kcEnd: 0.6, kcSource: 'fao-56', p: 0.5, pSource: 'fao-56', zrMin: 0.5, zrMax: 1.0, zrSource: 'fao-56', droughtSensitivity: 'moderate', preferredMoisture: 'Critical at flowering and pegging.', irrigationNotes: 'FAO-56 groundnut (peanut).', stageLabels: { mid: 'Flowering / pegging' } },
  { id: 'cowpea', name: 'Cowpea', category: 'legume', priority: 'medium', kcIni: 0.4, kcMid: 1.05, kcEnd: 0.6, kcSource: 'assumption', p: 0.45, pSource: 'fao-56', zrMin: 0.6, zrMax: 1.0, zrSource: 'fao-56', droughtSensitivity: 'low', preferredMoisture: 'Can dry a little more than tomato once established.', irrigationNotes: 'Cowpea Kc assumed from beans. p/Zr from FAO beans group.', analog: 'beans' },
  { id: 'soybean', name: 'Soybean', category: 'legume', priority: 'medium', kcIni: 0.4, kcMid: 1.15, kcEnd: 0.5, kcSource: 'fao-56', p: 0.5, pSource: 'fao-56', zrMin: 0.6, zrMax: 1.3, zrSource: 'fao-56', droughtSensitivity: 'moderate', preferredMoisture: 'Critical at flowering and pod fill.', irrigationNotes: 'FAO-56 soybean.' },
  { id: 'common-bean', name: 'Common bean', category: 'legume', priority: 'medium', kcIni: 0.4, kcMid: 1.15, kcEnd: 0.35, kcSource: 'fao-56', p: 0.45, pSource: 'fao-56', zrMin: 0.5, zrMax: 0.9, zrSource: 'fao-56', droughtSensitivity: 'moderate', preferredMoisture: 'Keep moist at flowering.', irrigationNotes: 'FAO-56 beans.' },
  { id: 'bambara', name: 'Bambara groundnut', category: 'legume', priority: 'low', kcIni: 0.4, kcMid: 1.05, kcEnd: 0.5, kcSource: 'assumption', p: 0.5, pSource: 'assumption', zrMin: 0.4, zrMax: 0.8, zrSource: 'assumption', droughtSensitivity: 'low', preferredMoisture: 'More drought-tolerant than soybean.', irrigationNotes: 'Not in FAO-56. Groundnut analog.', analog: 'groundnut' },
  { id: 'pigeon-pea', name: 'Pigeon pea', category: 'legume', priority: 'low', kcIni: 0.4, kcMid: 1.05, kcEnd: 0.5, kcSource: 'assumption', p: 0.5, pSource: 'assumption', zrMin: 0.8, zrMax: 1.5, zrSource: 'assumption', droughtSensitivity: 'low', preferredMoisture: 'Deep roots; less frequent refill.', irrigationNotes: 'Not in FAO-56. Drought-tolerant pulse analog.', analog: 'sorghum / pulse analog' },
  { id: 'plantain', name: 'Plantain', category: 'fruit', priority: 'high', kcIni: 0.5, kcMid: 1.1, kcEnd: 1.0, kcSource: 'assumption', p: 0.35, pSource: 'fao-56', zrMin: 0.5, zrMax: 0.9, zrSource: 'fao-56', droughtSensitivity: 'high', preferredMoisture: 'Banana family — do not let the mat dry.', irrigationNotes: 'Plantain is not separate in FAO-56. Banana Kc/p/Zr used.', analog: 'banana' },
  { id: 'banana', name: 'Banana', category: 'fruit', priority: 'high', kcIni: 0.5, kcMid: 1.1, kcEnd: 1.0, kcSource: 'fao-56', p: 0.35, pSource: 'fao-56', zrMin: 0.5, zrMax: 0.9, zrSource: 'fao-56', droughtSensitivity: 'high', preferredMoisture: 'High, steady water use.', irrigationNotes: 'FAO-56 banana. p 0.35.' },
  { id: 'pineapple', name: 'Pineapple', category: 'fruit', priority: 'low', kcIni: 0.5, kcMid: 0.3, kcEnd: 0.3, kcSource: 'fao-56', p: 0.5, pSource: 'fao-56', zrMin: 0.3, zrMax: 0.6, zrSource: 'fao-56', droughtSensitivity: 'low', preferredMoisture: 'CAM crop; low mid-season Kc.', irrigationNotes: 'FAO-56 pineapple has a low mid Kc (0.30) for the CAM pathway.' },
  { id: 'mango', name: 'Mango', category: 'fruit', priority: 'medium', kcIni: 0.4, kcMid: 0.9, kcEnd: 0.75, kcSource: 'assumption', p: 0.5, pSource: 'fao-56', zrMin: 1.0, zrMax: 1.5, zrSource: 'assumption', droughtSensitivity: 'moderate', preferredMoisture: 'Deep-rooted tree; irrigate at fruit set if dry.', irrigationNotes: 'Mango Kc is not in FAO-56 Table 12. Citrus-like tree analog for Kc; p from FAO trees 0.50.', analog: 'citrus / tropical fruit tree' },
  { id: 'citrus', name: 'Citrus (orange)', category: 'fruit', priority: 'medium', kcIni: 0.7, kcMid: 0.7, kcEnd: 0.7, kcSource: 'fao-56', p: 0.5, pSource: 'fao-56', zrMin: 1.2, zrMax: 1.5, zrSource: 'fao-56', droughtSensitivity: 'moderate', preferredMoisture: 'Evergreen; avoid severe stress at fruit enlargement.', irrigationNotes: 'FAO-56 citrus, clean weeding, 70% canopy as a typical orchard analog (Kc ~0.70).' },
  { id: 'papaya', name: 'Papaya', category: 'fruit', priority: 'high', kcIni: 0.5, kcMid: 1.05, kcEnd: 0.95, kcSource: 'assumption', p: 0.4, pSource: 'assumption', zrMin: 0.4, zrMax: 0.8, zrSource: 'assumption', droughtSensitivity: 'high', preferredMoisture: 'Shallow feeder roots; keep moist.', irrigationNotes: 'Not in FAO-56 Tables 12/22. Banana/vegetable-fruit analog.', analog: 'banana / fruit vegetable analog' },
  { id: 'avocado', name: 'Avocado', category: 'fruit', priority: 'high', kcIni: 0.6, kcMid: 0.85, kcEnd: 0.75, kcSource: 'fao-56', p: 0.5, pSource: 'assumption', zrMin: 0.8, zrMax: 1.2, zrSource: 'assumption', droughtSensitivity: 'high', preferredMoisture: 'Do not flood; also do not dry the shallow roots.', irrigationNotes: 'FAO-56 lists avocado Kc. p/Zr assumed for a shallow-rooted tree.', analog: 'avocado Kc from FAO-56; p/Zr assumed' },
  { id: 'coconut', name: 'Coconut', category: 'fruit', priority: 'medium', kcIni: 0.8, kcMid: 1.0, kcEnd: 1.0, kcSource: 'fao-56', p: 0.65, pSource: 'assumption', zrMin: 0.9, zrMax: 1.5, zrSource: 'assumption', droughtSensitivity: 'moderate', preferredMoisture: 'Palm; deep water use once established.', irrigationNotes: 'FAO-56 coconut Kc. p/Zr assumed for palms.', analog: 'coconut Kc from FAO-56; p/Zr assumed' },
  { id: 'cocoa', name: 'Cocoa', category: 'cash', priority: 'high', kcIni: 0.7, kcMid: 1.0, kcEnd: 0.95, kcSource: 'assumption', p: 0.4, pSource: 'assumption', zrMin: 0.6, zrMax: 1.0, zrSource: 'assumption', droughtSensitivity: 'high', preferredMoisture: 'Rainforest crop; dislikes dry spells at pod fill.', irrigationNotes: 'Cocoa is not in FAO-56 Tables 12/22. Coffee/banana analog.', analog: 'coffee / banana analog' },
  { id: 'coffee', name: 'Coffee', category: 'cash', priority: 'high', kcIni: 0.9, kcMid: 0.95, kcEnd: 0.95, kcSource: 'fao-56', p: 0.4, pSource: 'assumption', zrMin: 0.9, zrMax: 1.5, zrSource: 'fao-56', droughtSensitivity: 'high', preferredMoisture: 'Even moisture under shade or sun.', irrigationNotes: 'FAO-56 coffee (arabica, clean cultivated analog).' },
  { id: 'oil-palm', name: 'Oil palm', category: 'cash', priority: 'medium', kcIni: 0.9, kcMid: 1.0, kcEnd: 1.0, kcSource: 'assumption', p: 0.65, pSource: 'assumption', zrMin: 0.7, zrMax: 1.3, zrSource: 'assumption', droughtSensitivity: 'moderate', preferredMoisture: 'Palm; yield drops after long dry spells.', irrigationNotes: 'Oil palm is not in FAO-56 Table 12. Coconut analog.', analog: 'coconut' },
  { id: 'cashew', name: 'Cashew', category: 'cash', priority: 'low', kcIni: 0.4, kcMid: 0.75, kcEnd: 0.6, kcSource: 'assumption', p: 0.6, pSource: 'assumption', zrMin: 1.0, zrMax: 1.8, zrSource: 'assumption', droughtSensitivity: 'low', preferredMoisture: 'Drought-tolerant tree once established.', irrigationNotes: 'Not in FAO-56. Dryland tree analog.', analog: 'mango / dryland tree analog' },
  { id: 'shea', name: 'Shea', category: 'cash', priority: 'low', kcIni: 0.4, kcMid: 0.7, kcEnd: 0.6, kcSource: 'assumption', p: 0.65, pSource: 'assumption', zrMin: 1.2, zrMax: 2.0, zrSource: 'assumption', droughtSensitivity: 'low', preferredMoisture: 'Savanna tree; rarely irrigated.', irrigationNotes: 'Not in FAO-56. Dryland tree analog.', analog: 'dryland tree analog' },
  { id: 'cotton', name: 'Cotton', category: 'cash', priority: 'medium', kcIni: 0.35, kcMid: 1.15, kcEnd: 0.5, kcSource: 'fao-56', p: 0.65, pSource: 'fao-56', zrMin: 1.0, zrMax: 1.7, zrSource: 'fao-56', droughtSensitivity: 'low', preferredMoisture: 'Can deplete more of TAW (p 0.65) than vegetables.', irrigationNotes: 'FAO-56 cotton.' },
  { id: 'sugarcane', name: 'Sugarcane', category: 'cash', priority: 'high', kcIni: 0.4, kcMid: 1.25, kcEnd: 0.75, kcSource: 'fao-56', p: 0.65, pSource: 'fao-56', zrMin: 1.2, zrMax: 2.0, zrSource: 'fao-56', droughtSensitivity: 'moderate', preferredMoisture: 'Very high mid-season Kc (1.25).', irrigationNotes: 'FAO-56 sugarcane.' },
  { id: 'sesame', name: 'Sesame', category: 'spice', priority: 'low', kcIni: 0.35, kcMid: 1.1, kcEnd: 0.25, kcSource: 'assumption', p: 0.6, pSource: 'fao-56', zrMin: 0.5, zrMax: 1.0, zrSource: 'assumption', droughtSensitivity: 'low', preferredMoisture: 'Can dry more than leafy vegetables.', irrigationNotes: 'Sesame Kc assumed. p from FAO-56 Table 22 sesame/safflower group where listed as 0.60.', analog: 'sesame p from FAO-56; Kc assumed from oilseed analog' },
  { id: 'sunflower', name: 'Sunflower', category: 'cash', priority: 'medium', kcIni: 0.35, kcMid: 1.15, kcEnd: 0.35, kcSource: 'fao-56', p: 0.45, pSource: 'fao-56', zrMin: 0.8, zrMax: 1.5, zrSource: 'fao-56', droughtSensitivity: 'moderate', preferredMoisture: 'Critical at flowering.', irrigationNotes: 'FAO-56 sunflower.' },
  { id: 'tobacco', name: 'Tobacco', category: 'cash', priority: 'medium', kcIni: 0.4, kcMid: 1.15, kcEnd: 0.8, kcSource: 'fao-56', p: 0.4, pSource: 'assumption', zrMin: 0.5, zrMax: 1.0, zrSource: 'assumption', droughtSensitivity: 'moderate', preferredMoisture: 'Even moisture for leaf quality.', irrigationNotes: 'FAO-56 tobacco Kc. p/Zr assumed.', analog: 'tobacco Kc from FAO-56; p/Zr assumed' },
  { id: 'ginger', name: 'Ginger', category: 'spice', priority: 'high', kcIni: 0.6, kcMid: 1.0, kcEnd: 0.75, kcSource: 'assumption', p: 0.35, pSource: 'assumption', zrMin: 0.3, zrMax: 0.5, zrSource: 'assumption', droughtSensitivity: 'high', preferredMoisture: 'Shallow rhizomes; keep the bed moist.', irrigationNotes: 'Not in FAO-56. Shallow spice/tuber analog.', analog: 'potato / shallow spice analog' },
  { id: 'turmeric', name: 'Turmeric', category: 'spice', priority: 'high', kcIni: 0.6, kcMid: 1.0, kcEnd: 0.75, kcSource: 'assumption', p: 0.35, pSource: 'assumption', zrMin: 0.3, zrMax: 0.5, zrSource: 'assumption', droughtSensitivity: 'high', preferredMoisture: 'Like ginger; moist bed.', irrigationNotes: 'Not in FAO-56. Ginger analog.', analog: 'ginger analog' },
]

export const CROP_PROFILES: CropProfile[] = DRAFTS.map(buildCrop)

export function getCropProfile(id: string): CropProfile | undefined {
  return CROP_PROFILES.find((c) => c.id === id)
}
