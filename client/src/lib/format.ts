export function formatLiters(value: number): string {
  return `${Math.round(value).toLocaleString()} L`
}

export function formatRate(literPerMin: number): string {
  return `${literPerMin.toFixed(1)} L/min`
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`
}

export function formatDays(value: number): string {
  const rounded = Math.round(value)
  return `${rounded} ${rounded === 1 ? 'day' : 'days'}`
}

/**
 * Farmer-facing days-remaining. The server still caps an empty-usage
 * forecast at 365 internally; we do not show that cap when there has
 * been no watering to estimate from.
 */
export function formatDaysRemainingDisplay(daysRemaining: number, dailyConsumptionL: number): string {
  if (dailyConsumptionL <= 0) return '—'
  return formatDays(daysRemaining)
}

export function daysRemainingHint(dailyConsumptionL: number, weatherApplied: boolean): string {
  if (dailyConsumptionL <= 0) return 'Not enough watering data yet'
  return weatherApplied
    ? 'Rain chance is included'
    : 'Based on watering so far'
}

export function formatLitersPerDay(value: number): string {
  return `${Math.round(value).toLocaleString()} L/day`
}

export function formatTemperatureC(value: number): string {
  return `${Math.round(value)}°C`
}

export function formatMm(value: number): string {
  return `${value.toFixed(1)} mm`
}

export function formatTierLabel(tier: string): string {
  return tier.toUpperCase()
}

export function formatWhen(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export function formatSoilCondition(condition: string): string {
  if (condition === 'dry') return 'Dry'
  if (condition === 'wet') return 'Wet enough'
  return 'Healthy'
}

export function formatWateringAction(action: string): string {
  if (action === 'started') return 'Started watering'
  if (action === 'stopped') return 'Stopped watering'
  if (action === 'watering') return 'Watering'
  return 'Not watering'
}

export function formatIrrigationPreference(preference: string): string {
  if (preference === 'water-saving') return 'Save water'
  if (preference === 'aggressive') return 'Extra watering'
  return 'Usual watering'
}

export function formatIrrigationAdviceStatus(status: string): string {
  if (status === 'no-irrigation-needed') return 'No irrigation needed'
  if (status === 'monitor') return 'Monitor'
  if (status === 'irrigation-recommended') return 'Irrigation recommended'
  if (status === 'irrigation-urgent') return 'Irrigation urgent'
  if (status === 'irrigation-limited-by-water') return 'Limited by tank water'
  return status
}

export function formatNextCheckHours(hours: number): string {
  if (hours <= 1) return 'Check again in about 1 hour'
  return `Check again in about ${Math.round(hours)} hours`
}

/** Short soil name for lists. Internal soil ids stay the same. */
export function farmerSoilName(id: string | undefined): string {
  if (id === 'sand') return 'Sandy soil'
  if (id === 'sandy-loam') return 'Sandy loam'
  if (id === 'loam') return 'Loamy soil'
  if (id === 'silt-loam') return 'Silty soil'
  if (id === 'clay-loam') return 'Clay loam'
  if (id === 'clay') return 'Clay soil'
  return 'Loamy soil'
}

/** Soil choice shown in Settings. Internal id is unchanged. */
export function farmerSoilChoiceLabel(id: string): string {
  if (id === 'sand') return 'Sandy soil — drains water quickly'
  if (id === 'sandy-loam') return 'Sandy loam — drains fairly quickly'
  if (id === 'loam') return 'Loamy soil — holds water well'
  if (id === 'silt-loam') return 'Silty soil — holds water well'
  if (id === 'clay-loam') return 'Clay loam — holds water for longer'
  if (id === 'clay') return 'Clay soil — holds water for longer'
  return farmerSoilName(id)
}

/**
 * Everyday growth-stage wording. Internal stage ids (initial / vegetative /
 * mid / late) stay the same so watering math does not change.
 */
export function farmerGrowthStageLabel(stage: { id: string; name: string }): string {
  if (stage.id === 'initial') return 'Just planted'
  if (stage.id === 'vegetative') return 'Growing leaves'
  if (stage.id === 'late') return 'Ready for harvest'
  const name = stage.name.toLowerCase()
  if (name.includes('fruit') && name.includes('flower')) return 'Flowering / producing fruit'
  if (name.includes('fruit')) return 'Producing fruit'
  if (name.includes('grain') || name.includes('peg') || name.includes('flower')) return 'Flowering'
  return 'Flowering'
}
