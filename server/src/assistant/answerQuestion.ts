import { moistureTargetsForZone, type DataTag, type IrrigationZone, type ShortageTier } from '@aquaflow/shared'
import type { FarmState } from './loadFarmState.js'

function tagLabel(tag: DataTag): string {
  if (tag === 'measured') return 'measured'
  if (tag === 'estimated') return 'estimated (no flow sensor)'
  if (tag === 'forecast') return 'forecast'
  return 'simulated'
}

function liters(value: number): string {
  return `${Math.round(value).toLocaleString()} L`
}

function daysLabel(days: number, dailyUse: number): string {
  if (dailyUse <= 0) return 'Not enough watering data yet'
  const rounded = Math.round(days)
  return `${rounded} ${rounded === 1 ? 'day' : 'days'}`
}

function tankStatus(fillPct: number, lowPct: number, criticalPct: number): string {
  if (fillPct <= criticalPct) return 'Water level is too low'
  if (fillPct <= lowPct) return 'Water level is low'
  return 'Water level is good'
}

function shortageLine(tier: ShortageTier): string {
  if (tier === 'critical') return 'Water may run out soon'
  if (tier === 'high' || tier === 'moderate') return 'Water may run low soon'
  return 'Water looks fine'
}

function soilLine(zone: IrrigationZone): string {
  const { minPct } = moistureTargetsForZone(zone)
  const moisture = zone.state.soilMoisturePct.value
  if (zone.state.active) return `${zone.name} (${zone.crop.name}): watering now. Soil ${Math.round(moisture)}% (${tagLabel(zone.state.soilMoisturePct.tag)}).`
  if (moisture <= minPct) return `${zone.name} (${zone.crop.name}): soil is dry at ${Math.round(moisture)}% (${tagLabel(zone.state.soilMoisturePct.tag)}). This field needs water.`
  return `${zone.name} (${zone.crop.name}): soil looks good at ${Math.round(moisture)}% (${tagLabel(zone.state.soilMoisturePct.tag)}).`
}

function phaseLine(phase: string): string {
  if (phase === 'irrigating') return 'Watering now'
  if (phase === 'rain-detected') return 'Rain detected'
  if (phase === 'low-water') return 'Water level is low'
  if (phase === 'soil-moisture-sufficient') return 'Soil looks good'
  if (phase === 'waiting') return 'Waiting'
  return phase.replaceAll('-', ' ')
}

export function answerQuestion(topic: string, farm: FarmState): string {
  const { water, zones, system, planning } = farm
  const fillPct = (water.mainTankL.value / water.tank.capacityL) * 100
  const tankLine = `${tankStatus(fillPct, water.tank.lowThresholdPct, water.tank.criticalThresholdPct)}. ${liters(water.mainTankL.value)} in the tank (${Math.round(fillPct)}% full, ${tagLabel(water.mainTankL.tag)}).`

  if (topic === 'help') {
    return [
      'I can tell you about the tank, days of water left, shortage risk, soil, watering, and rain.',
      'You can also ask me to start or stop watering, or to switch Auto/Manual.',
      'If watering is blocked, I will say so — I use the same safety gate as the Irrigation buttons.',
    ].join('\n')
  }

  if (topic === 'tank') {
    return `${tankLine}\nAvailable water (main tank only): ${liters(water.totalAvailableL.value)} (${tagLabel(water.totalAvailableL.tag)}).`
  }

  if (topic === 'days') {
    const days = daysLabel(planning.daysRemaining.value, planning.sevenDayAverageConsumptionL.value)
    const extra =
      planning.sevenDayAverageConsumptionL.value <= 0
        ? days
        : `${days} of water left (${tagLabel(planning.daysRemaining.tag)}).`
    return extra
  }

  if (topic === 'shortage') {
    return `${shortageLine(planning.tier)}. ${planning.reason}`
  }

  if (topic === 'soil') {
    return zones.map(soilLine).join('\n')
  }

  if (topic === 'weather') {
    const raining = system.rain.isRaining.value
    const sensorLine = raining
      ? `Farm rain sensor: rain detected (${tagLabel(system.rain.isRaining.tag)}). Calculated rainwater is being added to the main tank, not to a separate rain tank.`
      : `Farm rain sensor: no rain right now (${tagLabel(system.rain.isRaining.tag)}).`
    const forecast = planning.weather
    if (forecast.available && forecast.condition) {
      const temp =
        forecast.temperatureC !== undefined ? ` ${Math.round(forecast.temperatureC.value)}°C.` : ''
      const chance =
        forecast.precipitationProbabilityPct !== undefined
          ? ` Rain chance ${Math.round(forecast.precipitationProbabilityPct.value)}% (${tagLabel(forecast.precipitationProbabilityPct.tag)}).`
          : ''
      const place = forecast.location?.label ? ` for ${forecast.location.label}` : ''
      const cond =
        forecast.condition === 'rain'
          ? `Rain is in the forecast${place}.`
          : forecast.condition === 'hot-dry'
            ? `The forecast${place} is hot and dry.`
            : `The forecast${place} does not show rain.`
      return `${cond}${temp}${chance} ${sensorLine} Watering still follows the stored water and the soil.`
    }
    return `${sensorLine} ${forecast.reason ?? 'Weather forecast is not available.'} Watering still follows the stored water and the soil.`
  }

  if (topic === 'irrigation') {
    const watering = zones.filter((z) => z.state.active)
    const pump = system.pump.isOn.value ? 'on' : 'off'
    const mode = system.system.operationMode === 'auto' ? 'Auto' : 'Manual'
    const fields =
      watering.length > 0
        ? `Watering now on: ${watering.map((z) => z.name).join(', ')}.`
        : 'No field is watering right now.'
    return `${phaseLine(system.system.phase)}. ${fields} Pump is ${pump} (${tagLabel(system.pump.isOn.tag)}). Mode: ${mode}.`
  }

  const days = daysLabel(planning.daysRemaining.value, planning.sevenDayAverageConsumptionL.value)
  const soilNeed = zones.some((z) => {
    const { minPct } = moistureTargetsForZone(z)
    return !z.state.active && z.state.soilMoisturePct.value <= minPct
  })
  return [
    tankLine,
    `Days remaining: ${days} (${tagLabel(planning.daysRemaining.tag)}).`,
    shortageLine(planning.tier) + '.',
    soilNeed ? 'At least one field has dry soil and needs water.' : 'Soil looks good on the fields that are not watering.',
    system.rain.isRaining.value ? 'Rain detected.' : 'No rain right now.',
    phaseLine(system.system.phase) + '.',
  ].join('\n')
}
