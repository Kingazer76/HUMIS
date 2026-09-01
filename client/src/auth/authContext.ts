import { createContext, useContext } from 'react'
import type { AuthUserPublic } from '@aquaflow/shared'

export interface AuthContextValue {
  user: AuthUserPublic | null
  loading: boolean
  setUser: (user: AuthUserPublic | null) => void
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}

