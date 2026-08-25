import { useId } from 'react'
import { cn } from '@/lib/utils'

const SIZE = 'h-16 w-16'

function WateringDrops() {
  return (
    <g aria-hidden="true">
      <circle className="aquaflow-water-drop" cx="22" cy="8" r="1.7" fill="#0288d1" />
      <circle className="aquaflow-water-drop aquaflow-water-drop-2" cx="28" cy="6" r="1.7" fill="#0288d1" />
      <circle className="aquaflow-water-drop aquaflow-water-drop-3" cx="34" cy="8" r="1.7" fill="#0288d1" />
    </g>
  )
}

/**
 * One cylindrical farm storage tank. Water height follows the real fill
 * percent when given; color still follows the high/low/critical state.
 */
export function TankLevelIllustration({
  state,
  fillPct,
  className,
}: {
  state: 'high' | 'low' | 'critical'
  fillPct?: number
  className?: string
}) {
  const clipId = `tank-water-${useId().replace(/:/g, '')}`
  const fallback = state === 'high' ? 78 : state === 'low' ? 38 : 14
  const pct = Math.min(100, Math.max(0, fillPct ?? fallback))
  const water = state === 'high' ? '#00897b' : state === 'low' ? '#d97706' : '#c2410c'
  const innerTop = 16
  const innerH = 30
  const waterH = Math.max(pct > 0 ? 2 : 0, (pct / 100) * innerH)
  const waterY = innerTop + innerH - waterH
  const label =
    state === 'high' ? 'Storage tank, water level is good' : state === 'low' ? 'Storage tank, water level is low' : 'Storage tank, water level is too low'

  return (
    <svg viewBox="0 0 64 64" className={cn(SIZE, className)} role="img" aria-label={label}>
      <defs>
        <clipPath id={clipId}>
          <rect x="16" y={innerTop} width="32" height={innerH} rx="2" />
        </clipPath>
      </defs>
      {/* Tank body */}
      <rect x="15" y="14" width="34" height="34" rx="3" fill="#eef6f0" stroke="#1f2a24" strokeWidth="1.6" />
      {/* Hoop bands — typical farm tank */}
      <path d="M15 24 h34 M15 34 h34 M15 44 h34" stroke="#6b7a72" strokeWidth="1" opacity="0.55" />
      {/* Stored water */}
      <g clipPath={`url(#${clipId})`}>
        <rect x="16" y={waterY} width="32" height={waterH} fill={water} />
        {waterH > 0 ? <ellipse cx="32" cy={waterY} rx="16" ry="3.2" fill={water} opacity="0.85" /> : null}
      </g>
      {/* Lid / roof */}
      <ellipse cx="32" cy="14" rx="18" ry="5.5" fill="#cfd8d3" stroke="#1f2a24" strokeWidth="1.6" />
      <ellipse cx="32" cy="12.5" rx="8" ry="2.4" fill="#eef6f0" stroke="#1f2a24" strokeWidth="1" />
      {/* Outlet tap — shows this is a storage tank, not a second tank */}
      <path d="M49 42 h6 v4 h-3" fill="none" stroke="#1f2a24" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="55" cy="47.5" r="1.6" fill="#00897b" />
      {/* Short stand */}
      <path d="M20 48 v6 M44 48 v6 M18 54 h28" stroke="#1f2a24" strokeWidth="1.6" strokeLinecap="round" />
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
  const label =
    state === 'dry' ? 'Soil is dry' : state === 'irrigating' ? 'Watering now' : 'Soil looks good'
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
          <path d="M12 10 h8" stroke="#00897b" strokeWidth="2" strokeLinecap="round" />
          <path d="M20 10 C24 10 26 14 28 16" fill="none" stroke="#0288d1" strokeWidth="1.6" />
          <WateringDrops />
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
  const label = state === 'rain' ? 'Rain detected' : state === 'hot-dry' ? 'Hot and dry' : 'No rain'
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
  const label = state === 'running' ? 'Watering now' : state === 'needs-attention' ? 'Needs water' : 'Not watering'
  return (
    <svg viewBox="0 0 56 56" className={cn(SIZE, className)} role="img" aria-label={label}>
      {state === 'running' ? (
        <>
          <ellipse cx="28" cy="46" rx="16" ry="5" fill="#5d4037" opacity="0.85" />
          <path d="M28 44 C28 32 20 30 22 22" fill="none" stroke="#2e7d32" strokeWidth="2.2" />
          <circle cx="22" cy="22" r="3.2" fill="#66bb6a" />
          <path d="M10 12 h10" stroke="#00897b" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M20 12 C26 12 28 18 30 22" fill="none" stroke="#0288d1" strokeWidth="1.8" />
          <WateringDrops />
        </>
      ) : null}
      {state === 'healthy' ? (
        <>
          <circle cx="28" cy="28" r="22" fill="#e8f5e9" />
          <path d="M18 30 l7 7 14-16" fill="none" stroke="#2e7d32" strokeWidth="3.5" strokeLinecap="round" />
        </>
      ) : null}
      {state === 'needs-attention' ? (
        <>
          <circle cx="28" cy="28" r="22" fill="#fff8e1" />
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
      ? 'Water may run out soon'
      : tier === 'high' || tier === 'moderate'
        ? 'Water may run low soon'
        : 'Water looks fine'
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
