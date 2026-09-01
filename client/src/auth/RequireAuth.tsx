import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/auth/authContext'
import { safeNextPath } from '@/auth/rules'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-3 bg-background px-6">
        <img src="/logo.png?v=clear" alt="" className="h-12 w-12 object-contain" />
        <p className="text-sm text-muted-foreground">Loading HUMIS…</p>
      </div>
    )
  }

  if (!user) {
    const next = `${location.pathname}${location.search}`
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />
  }

  return children
}

export function GuestOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  const next = new URLSearchParams(location.search).get('next')

  if (loading) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-3 bg-background px-6">
        <img src="/logo.png?v=clear" alt="" className="h-12 w-12 object-contain" />
        <p className="text-sm text-muted-foreground">Loading HUMIS…</p>
      </div>
    )
  }

  if (user) {
    const target = safeNextPath(next)
    return <Navigate to={target} replace />
  }

  return children
}
