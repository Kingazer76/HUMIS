import { useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { TabActiveContext } from '@/hooks/tabActivity'
import { OverviewPage } from '@/pages/OverviewPage'
import { IrrigationPage } from '@/pages/IrrigationPage'
import { WaterPage } from '@/pages/WaterPage'
import { PlanningPage } from '@/pages/PlanningPage'
import { HistoryPage } from '@/pages/HistoryPage'
import { SettingsPage } from '@/pages/SettingsPage'

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
    <AppLayout>
      <TabPages />
    </AppLayout>
  )
}

export default App
