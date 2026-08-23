import type { ReactNode } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface SectionCardProps {
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  children?: ReactNode
  className?: string
}

/** A titled card shell for sections that aren't a single big metric (lists, forms, flow diagrams). */
export function SectionCard({ icon, title, description, action, children, className }: SectionCardProps) {
  return (
    <Card className={cn('gap-4', className)}>
      <CardHeader className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            {icon ? <span className="text-primary">{icon}</span> : null}
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
