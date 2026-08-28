import type { ReactNode } from 'react'

/** Extra numbers a farmer does not need on first look. Same values, tucked away. */
export function MoreDetails({ children }: { children: ReactNode }) {
  return (
    <details className="mt-3 rounded-lg border border-border bg-muted/30 px-3 py-2">
      <summary className="cursor-pointer text-sm font-medium text-foreground">More details</summary>
      <div className="mt-2 flex flex-col gap-3">{children}</div>
    </details>
  )
}

export function SettingHint({ children }: { children: ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>
}
