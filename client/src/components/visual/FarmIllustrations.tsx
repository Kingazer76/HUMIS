import { cn } from '@/lib/utils'

const SIZE = 'h-14 w-14'

/** Simple tank picture. Fill height is by state, not the exact litre count. */
export function TankLevelIllustration({
  state,
  className,
}: {
  state: 'high' | 'low' | 'critical'
  className?: string
}) {
  const fill = state === 'high' ? 0.78 : state === 'low' ? 0.38 : 0.14
  const water = state === 'high' ? '#00897b' : state === 'low' ? '#d97706' : '#c2410c'
  const y = 8 + (36 - 36 * fill)
  const h = 36 * fill

  return (
    <svg
      viewBox="0 0 56 56"
      className={cn(SIZE, className)}
      role="img"
      aria-label={state === 'high' ? 'Tank looks full' : state === 'low' ? 'Tank looks low' : 'Tank looks empty'}
    >
      <rect x="14" y="6" width="28" height="40" rx="4" fill="#eef6f0" stroke="#1f2a24" strokeWidth="1.5" />
      <rect x="16" y={y} width="24" height={h} rx="2" fill={water} />
      <rect x="20" y="4" width="16" height="5" rx="1.5" fill="#6b7a72" />
    </svg>
  )
}

export function SoilStateIllustration({
  state,
  className,
}: {
  state: 'dry' | 'healthy' | 'irrigating'
  className?: string
}) {
  const label = state === 'dry' ? 'Dry soil' : state === 'irrigating' ? 'Watering soil' : 'Healthy soil'
  return (
    <svg viewBox="0 0 56 56" className={cn(SIZE, className)} role="img" aria-label={label}>
      <ellipse cx="28" cy="42" rx="18" ry="7" fill={state === 'dry' ? '#c2410c' : '#5d4037'} opacity="0.85" />
      {state === 'dry' ? (
        <>
          <path d="M16 40 l8-2 M28 43 l10-3 M22 44 l12 0" stroke="#8d3b12" strokeWidth="1.2" />
          <path d="M28 38 C26 30 22 26 28 18" fill="none" stroke="#a16207" strokeWidth="2" />
        </>
      ) : (
        <>
          <path d="M28 40 C28 28 18 26 20 18" fill="none" stroke="#2e7d32" strokeWidth="2.2" />
          <path d="M28 32 C32 28 38 28 36 20" fill="none" stroke="#43a047" strokeWidth="2" />
          <circle cx="20" cy="18" r="3.5" fill="#66bb6a" />
          <circle cx="36" cy="20" r="3.5" fill="#81c784" />
        </>
      )}
      {state === 'irrigating' ? (
        <>
          <circle cx="18" cy="12" r="1.6" fill="#0288d1" />
          <circle cx="24" cy="8" r="1.6" fill="#0288d1" />
          <circle cx="40" cy="11" r="1.6" fill="#0288d1" />
        </>
      ) : null}
    </svg>
  )
}

export function WeatherIllustration({
  state,
  className,
}: {
  state: 'rain' | 'hot-dry' | 'normal'
  className?: string
}) {
  const label = state === 'rain' ? 'Rain' : state === 'hot-dry' ? 'Hot and dry' : 'No rain'
  return (
    <svg viewBox="0 0 56 56" className={cn(SIZE, className)} role="img" aria-label={label}>
      {state === 'rain' ? (
        <>
          <ellipse cx="28" cy="22" rx="14" ry="9" fill="#90a4ae" />
          <ellipse cx="20" cy="24" rx="8" ry="6" fill="#b0bec5" />
          <ellipse cx="36" cy="24" rx="8" ry="6" fill="#b0bec5" />
          <path d="M20 34 l-2 8 M28 34 l-2 8 M36 34 l-2 8" stroke="#0288d1" strokeWidth="2" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="28" cy="26" r="10" fill={state === 'hot-dry' ? '#e65100' : '#f9a825'} />
          <g stroke={state === 'hot-dry' ? '#bf360c' : '#fbc02d'} strokeWidth="2" strokeLinecap="round">
            <path d="M28 8 v4 M28 40 v4 M12 26 h4 M40 26 h4 M16 14 l3 3 M37 35 l3 3 M16 38 l3-3 M37 17 l3-3" />
          </g>
        </>
      )}
    </svg>
  )
}

export function IrrigationStateIllustration({
  state,
  className,
}: {
  state: 'running' | 'healthy' | 'needs-attention'
  className?: string
}) {
  const label =
    state === 'running' ? 'Watering' : state === 'needs-attention' ? 'Needs water' : 'Field is fine'
  return (
    <svg viewBox="0 0 56 56" className={cn(SIZE, className)} role="img" aria-label={label}>
      <circle
        cx="28"
        cy="28"
        r="22"
        fill={state === 'running' ? '#e0f2f1' : state === 'needs-attention' ? '#fff8e1' : '#e8f5e9'}
      />
      {state === 'running' ? (
        <>
          <path d="M28 14 C20 26 20 34 28 42 C36 34 36 26 28 14 Z" fill="#00897b" />
          <circle cx="28" cy="30" r="4" fill="#e0f7fa" />
        </>
      ) : null}
      {state === 'healthy' ? (
        <path d="M18 30 l7 7 14-16" fill="none" stroke="#2e7d32" strokeWidth="3.5" strokeLinecap="round" />
      ) : null}
      {state === 'needs-attention' ? (
        <>
          <path d="M28 14 v18" stroke="#e65100" strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="28" cy="40" r="2.4" fill="#e65100" />
        </>
      ) : null}
    </svg>
  )
}

export function ShortageStateIllustration({
  tier,
  className,
}: {
  tier: 'low' | 'moderate' | 'high' | 'critical'
  className?: string
}) {
  const label =
    tier === 'critical'
      ? 'Critical shortage'
      : tier === 'high'
        ? 'High shortage risk'
        : tier === 'moderate'
          ? 'Moderate shortage risk'
          : 'Shortage risk is low'
  const fill =
    tier === 'critical' ? '#c62828' : tier === 'high' ? '#ef6c00' : tier === 'moderate' ? '#f9a825' : '#2e7d32'
  return (
    <svg viewBox="0 0 56 56" className={cn(SIZE, className)} role="img" aria-label={label}>
      <path d="M28 8 L50 46 H6 Z" fill={fill} />
      <path d="M28 22 v14" stroke="white" strokeWidth="3" strokeLinecap="round" />
      <circle cx="28" cy="40" r="2.2" fill="white" />
    </svg>
  )
}
