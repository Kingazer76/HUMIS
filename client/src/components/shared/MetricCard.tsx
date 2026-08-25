import type { ReactNode } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { StatusTone } from '@/components/shared/StatusBadge'
import { statusCardClass, statusHeadlineClass, statusIconClass } from '@/lib/statusTone'
import { cn } from '@/lib/utils'

interface MetricCardProps {
  icon: ReactNode
  label: string
  badge?: ReactNode
  /** Pass a real value once a phase wires this card to data; omit to render a loading skeleton. */
  value?: ReactNode
  hint?: ReactNode
  /** Farmer-facing picture + headline. When set, `value` is shown as smaller detail. */
  glance?: ReactNode
  /** Healthy / warning / critical wash. Never gold. */
  tone?: StatusTone
  /** Larger number for glance facts such as days remaining. */
  emphasize?: boolean
  className?: string
}

/**
 * The recurring "metric card" pattern: small icon + label, a big value,
 * optional status badge, optional picture-first glance.
 */
export function MetricCard({
  icon,
  label,
  badge,
  value,
  hint,
  glance,
  tone,
  emphasize = false,
  className,
}: MetricCardProps) {
  return (
    <Card className={cn('gap-3', statusCardClass(tone), className)}>
      <CardHeader className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground">
          <span className={statusIconClass(tone)}>{icon}</span>
          {label}
        </div>
        {badge}
      </CardHeader>
      <CardContent>
        {glance ? (
          <div className="flex flex-col gap-2">
            {glance}
            {value !== undefined ? (
              <div
                className={cn(
                  emphasize
                    ? 'text-3xl font-bold tracking-tight text-foreground tabular-nums sm:text-4xl'
                    : 'text-sm font-medium text-muted-foreground',
                )}
              >
                {value}
              </div>
            ) : null}
            {hint !== undefined ? <div className="text-sm text-muted-foreground">{hint}</div> : null}
          </div>
        ) : value !== undefined ? (
          <div
            className={cn(
              'tracking-tight tabular-nums',
              emphasize
                ? `text-4xl font-bold sm:text-5xl ${statusHeadlineClass(tone)}`
                : 'text-2xl font-semibold text-foreground sm:text-3xl',
            )}
          >
            {value}
          </div>
        ) : (
          <Skeleton className="h-8 w-24" />
        )}
        {!glance && hint !== undefined ? (
          <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
        ) : !glance && value === undefined ? (
          <Skeleton className="mt-2 h-4 w-32" />
        ) : null}
      </CardContent>
    </Card>
  )
}
