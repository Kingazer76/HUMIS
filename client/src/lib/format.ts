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

export function formatLitersPerDay(value: number): string {
  return `${Math.round(value).toLocaleString()} L/day`
}

export function formatTierLabel(tier: string): string {
  return tier.toUpperCase()
}
