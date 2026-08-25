import type { StatusTone } from '@/components/shared/StatusBadge'

/** Card edge and wash. Gold is never used here — it is a navigation color only. */
const CARD: Record<StatusTone, string> = {
  good: 'border-success/40 bg-success/[0.07] border-l-4 border-l-success',
  warning: 'border-warning/45 bg-warning/[0.09] border-l-4 border-l-warning',
  critical: 'border-destructive/50 bg-destructive/10 border-l-4 border-l-destructive',
  info: 'border-primary/40 bg-primary/[0.07] border-l-4 border-l-primary',
  neutral: '',
}

const HEADLINE: Record<StatusTone, string> = {
  good: 'text-success',
  warning: 'text-warning',
  critical: 'text-destructive',
  info: 'text-primary',
  neutral: 'text-foreground',
}

const ICON: Record<StatusTone, string> = {
  good: 'text-success',
  warning: 'text-warning',
  critical: 'text-destructive',
  info: 'text-primary',
  neutral: 'text-primary',
}

export function statusCardClass(tone?: StatusTone): string {
  return tone ? CARD[tone] : ''
}

export function statusHeadlineClass(tone?: StatusTone): string {
  return tone ? HEADLINE[tone] : 'text-foreground'
}

export function statusIconClass(tone?: StatusTone): string {
  return tone ? ICON[tone] : 'text-primary'
}
