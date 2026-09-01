import { useState, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthProvider'
import { GuestOnly, RequireAuth } from '@/auth/RequireAuth'
import { AppLayout } from '@/components/layout/AppLayout'
import { TabActiveContext } from '@/hooks/tabActivity'
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage'
import { IrrigationPage } from '@/pages/IrrigationPage'
import { LoginPage } from '@/pages/LoginPage'
import { OverviewPage } from '@/pages/OverviewPage'
import { PlanningPage } from '@/pages/PlanningPage'
import { HistoryPage } from '@/pages/HistoryPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { ResetPasswordPage } from '@/pages/ResetPasswordPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { WaterPage } from '@/pages/WaterPage'

const TABS = [
  { path: '/overview', Page: OverviewPage },
  { path: '/irrigation', Page: IrrigationPage },
  { path: '/water', Page: WaterPage },
  { path: '/planning', Page: PlanningPage },
  { path: '/history', Page: HistoryPage },
  { path: '/settings', Page: SettingsPage },
] as const

const TAB_PATHS: Set<string> = new Set(TABS.map((tab) => tab.path))

/**
 * Keeps a tab mounted after the first visit so switching back does not
 * blank the screen or restart loading. Hidden tabs are not shown and
 * pause their polling.
 */
function KeptTab({ active, children }: { active: boolean; children: ReactNode }) {
  const [visited, setVisited] = useState(active)
  if (active && !visited) {
    setVisited(true)
  }

  if (!visited && !active) return null

  return (
    <TabActiveContext.Provider value={active}>
      <div hidden={!active} aria-hidden={!active}>
        {children}
      </div>
    </TabActiveContext.Provider>
  )
}

function TabPages() {
  const { pathname } = useLocation()
  if (pathname === '/' || !TAB_PATHS.has(pathname)) {
    return <Navigate to="/overview" replace />
  }

  return (
    <>
      {TABS.map(({ path, Page }) => (
        <KeptTab key={path} active={pathname === path}>
          <Page />
        </KeptTab>
      ))}
    </>
  )
}

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route
          path="/login"
          element={
            <GuestOnly>
              <LoginPage />
            </GuestOnly>
          }
        />
        <Route
          path="/register"
          element={
            <GuestOnly>
              <RegisterPage />
            </GuestOnly>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <GuestOnly>
              <ForgotPasswordPage />
            </GuestOnly>
          }
        />
        <Route
          path="/reset-password"
          element={
            <GuestOnly>
              <ResetPasswordPage />
            </GuestOnly>
          }
        />
        <Route
          path="*"
          element={
            <RequireAuth>
              <AppLayout>
                <TabPages />
              </AppLayout>
            </RequireAuth>
          }
        />
      </Routes>
    </AuthProvider>
  )
}

export default App
