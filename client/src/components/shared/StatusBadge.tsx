import type { ReactNode } from 'react'
import type { ShortageTier } from '@aquaflow/shared'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type StatusTone = 'good' | 'warning' | 'critical' | 'info' | 'neutral'

const STYLE: Record<StatusTone, string> = {
  good: 'border-transparent bg-primary/10 text-primary',
  warning: 'border-transparent bg-amber-100 text-amber-800',
  critical: 'border-transparent bg-red-100 text-red-700',
  info: 'border-transparent bg-sky-100 text-sky-800',
  neutral: 'border-transparent bg-secondary text-muted-foreground',
}

const SHORTAGE_TIER_TONE: Record<ShortageTier, StatusTone> = {
  low: 'good',
  moderate: 'warning',
  high: 'warning',
  critical: 'critical',
}

/** Maps a shortagePrediction tier to the matching status-badge tone. */
export function shortageTierTone(tier: ShortageTier): StatusTone {
  return SHORTAGE_TIER_TONE[tier]
}

/** V1's small status pills (NORMAL, OK, CLEAR, Waiting, Irrigating, ...), color-coded by tone. */
export function StatusBadge({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  return (
    <Badge variant="outline" className={cn(STYLE[tone], 'uppercase tracking-wide')}>
      {children}
    </Badge>
  )
}
