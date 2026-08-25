import type { ReactNode } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import type { StatusTone } from '@/components/shared/StatusBadge'
import { statusCardClass, statusIconClass } from '@/lib/statusTone'
import { cn } from '@/lib/utils'

interface SectionCardProps {
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  children?: ReactNode
  tone?: StatusTone
  className?: string
}

/** A titled card shell for sections that aren't a single big metric (lists, forms, flow diagrams). */
export function SectionCard({
  icon,
  title,
  description,
  action,
  children,
  tone,
  className,
}: SectionCardProps) {
  return (
    <Card className={cn('gap-4', statusCardClass(tone), className)}>
      <CardHeader className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-base font-semibold text-foreground">
            {icon ? <span className={statusIconClass(tone)}>{icon}</span> : null}
            {title}
          </div>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {action}
      </CardHeader>
      {children ? <CardContent>{children}</CardContent> : null}
    </Card>
  )
}
