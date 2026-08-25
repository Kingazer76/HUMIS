import type { ReactNode } from 'react'
import type { ShortageTier } from '@aquaflow/shared'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type StatusTone = 'good' | 'warning' | 'critical' | 'info' | 'neutral'

const STYLE: Record<StatusTone, string> = {
  good: 'border-success/35 bg-success/10 text-success',
  warning: 'border-warning/40 bg-warning/10 text-warning',
  critical: 'border-destructive/40 bg-destructive/10 text-destructive',
  info: 'border-primary/35 bg-primary/10 text-primary',
  neutral: 'border-border bg-secondary text-muted-foreground',
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

/** Small status pills, color-coded by tone. Wording stays as passed in. */
export function StatusBadge({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  return (
    <Badge variant="outline" className={cn(STYLE[tone])}>
      {children}
    </Badge>
  )
}
