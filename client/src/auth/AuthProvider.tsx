import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AuthUserPublic } from '@aquaflow/shared'
import { authApi } from '@/auth/authApi'
import { AuthContext } from '@/auth/authContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUserPublic | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const refresh = useCallback(async () => {
    try {
      const next = await authApi.me()
      setUser(next)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    function onUnauthorized() {
      setUser(null)
      const next = `${window.location.pathname}${window.location.search}`
      if (next.startsWith('/login')) return
      navigate(`/login?next=${encodeURIComponent(next)}`, { replace: true })
    }
    window.addEventListener('humis:unauthorized', onUnauthorized)
    return () => window.removeEventListener('humis:unauthorized', onUnauthorized)
  }, [navigate])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } finally {
      setUser(null)
      navigate('/login', { replace: true })
    }
  }, [navigate])

  const value = useMemo(
    () => ({ user, loading, setUser, logout, refresh }),
    [user, loading, logout, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
