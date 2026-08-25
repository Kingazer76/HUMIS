import type { ReactNode } from 'react'
import type { StatusTone } from '@/components/shared/StatusBadge'
import { statusHeadlineClass } from '@/lib/statusTone'

/** Picture + plain-language headline, with the technical number kept smaller underneath. */
export function VisualGlance({
  illustration,
  headline,
  detail,
  tone,
}: {
  illustration: ReactNode
  headline: string
  detail?: ReactNode
  tone?: StatusTone
}) {
  return (
    <div className="flex items-center gap-4">
      <div className="shrink-0">{illustration}</div>
      <div className="min-w-0">
        <p className={`text-xl font-semibold leading-snug ${statusHeadlineClass(tone)}`}>{headline}</p>
        {detail !== undefined ? <div className="mt-0.5 text-sm text-muted-foreground">{detail}</div> : null}
      </div>
    </div>
  )
}
