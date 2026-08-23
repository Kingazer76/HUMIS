import type { ReactNode } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface MetricCardProps {
  icon: ReactNode
  label: string
  badge?: ReactNode
  /** Pass a real value once a phase wires this card to data; omit to render a loading skeleton. */
  value?: ReactNode
  hint?: ReactNode
  className?: string
}

/**
 * The recurring "metric card" pattern from V1: small icon + label, a big
 * value, optional status badge top-right, optional small hint text below.
 * Used as a placeholder skeleton in Phase 0 and reused once real/simulated
 * data is wired in later phases.
 */
export function MetricCard({ icon, label, badge, value, hint, className }: MetricCardProps) {
  return (
    <Card className={cn('gap-3', className)}>
      <CardHeader className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="text-primary">{icon}</span>
          {label}
        </div>
        {badge}
      </CardHeader>
      <CardContent>
        {value !== undefined ? (
          <div className="text-3xl font-bold tracking-tight text-foreground">{value}</div>
        ) : (
          <Skeleton className="h-8 w-24" />
        )}
        {hint !== undefined ? (
          <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
        ) : (
          <Skeleton className="mt-2 h-4 w-32" />
        )}
      </CardContent>
    </Card>
  )
}
