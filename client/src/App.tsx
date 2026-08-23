import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { OverviewPage } from '@/pages/OverviewPage'
import { IrrigationPage } from '@/pages/IrrigationPage'
import { WaterPage } from '@/pages/WaterPage'
import { PlanningPage } from '@/pages/PlanningPage'
import { HistoryPage } from '@/pages/HistoryPage'
import { SettingsPage } from '@/pages/SettingsPage'

function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Navigate to="/overview" replace />} />
        <Route path="/overview" element={<OverviewPage />} />
        <Route path="/irrigation" element={<IrrigationPage />} />
        <Route path="/water" element={<WaterPage />} />
        <Route path="/planning" element={<PlanningPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/overview" replace />} />
      </Routes>
    </AppLayout>
  )
}

export default App
