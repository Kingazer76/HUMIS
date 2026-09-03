import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AddToHomeHint } from '@/components/auth/AddToHomeHint'

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="min-h-svh bg-background pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      <div className="mx-auto grid min-h-svh max-w-5xl lg:grid-cols-[minmax(0,18rem)_minmax(0,24rem)] lg:items-center lg:justify-center lg:gap-16 lg:px-8">
        <aside className="hidden px-8 py-10 lg:block">
          <Link to="/login" className="inline-flex items-center gap-3">
            <img src="/logo.png?v=clear" alt="" className="h-12 w-12 object-contain" />
            <img src="/humis-wordmark.png" alt="HUMIS" className="h-8 w-auto object-contain" />
          </Link>
          <p className="mt-8 text-lg font-medium leading-snug text-foreground">
            Smart water management for farms.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Sign in to see tank water, irrigation, and the HUMIS Assistant for your farm.
          </p>
        </aside>

        <div className="flex min-h-svh flex-col px-4 py-8 sm:px-6 lg:min-h-0 lg:py-12">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <img src="/logo.png?v=clear" alt="" className="h-10 w-10 object-contain" />
            <img src="/humis-wordmark.png" alt="HUMIS" className="h-7 w-auto object-contain" />
          </div>

          <div className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
            <div className="mt-6">{children}</div>
          </div>

          {footer ? <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div> : null}
          <AddToHomeHint />
        </div>
      </div>
    </div>
  )
}
