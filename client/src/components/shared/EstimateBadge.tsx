import type { DataTag } from '@aquaflow/shared'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const LABEL: Record<DataTag, string> = {
  measured: 'measured',
  estimated: 'estimated',
  simulated: 'simulated',
  forecast: 'forecast',
}

const STYLE: Record<DataTag, string> = {
  measured: 'border-transparent bg-primary/10 text-primary',
  estimated: 'border-transparent bg-amber-100 text-amber-800',
  simulated: 'border-transparent bg-secondary text-muted-foreground',
  forecast: 'border-transparent bg-sky-100 text-sky-800',
}

/**
 * The single place that renders a data-provenance label. Every reading
 * shown anywhere in the UI must say whether it was measured, estimated,
 * simulated, or forecast — this component is how that rule (decisions 4/5)
 * stays enforced by one piece of code instead of being repeated by hand.
 */
export function EstimateBadge({ tag, className }: { tag: DataTag; className?: string }) {
  return (
    <Badge variant="outline" className={cn(STYLE[tag], className)}>
      {LABEL[tag]}
    </Badge>
  )
}
