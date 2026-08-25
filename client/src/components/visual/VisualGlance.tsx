import type { ReactNode } from 'react'

/** Picture + plain-language headline, with the technical number kept smaller underneath. */
export function VisualGlance({
  illustration,
  headline,
  detail,
}: {
  illustration: ReactNode
  headline: string
  detail?: ReactNode
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="shrink-0">{illustration}</div>
      <div className="min-w-0">
        <p className="text-lg font-semibold leading-tight text-foreground">{headline}</p>
        {detail !== undefined ? <div className="mt-0.5 text-sm text-muted-foreground">{detail}</div> : null}
      </div>
    </div>
  )
}
