export function formatLiters(value: number): string {
  return `${Math.round(value).toLocaleString()} L`
}

export function formatRate(literPerMin: number): string {
  return `${literPerMin.toFixed(1)} L/min`
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`
}
