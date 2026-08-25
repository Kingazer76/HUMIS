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
    ? 'Weather forecast available'
    : 'Weather forecast unavailable — based on usage data only'
}

export function formatLitersPerDay(value: number): string {
  return `${Math.round(value).toLocaleString()} L/day`
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
