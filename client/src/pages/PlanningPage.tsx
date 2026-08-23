import { AlertTriangle, CalendarDays, CloudSun, Leaf, ShieldCheck } from 'lucide-react'
import { MetricCard } from '@/components/shared/MetricCard'
import { SectionCard } from '@/components/shared/SectionCard'

/**
 * V1's Planning tab: conservation mode banner, days remaining + shortage
 * prediction, weather outlook + projected demand, then alerts. Every
 * number here is a forecast/estimate and must say so once wired (Phase 4).
 */
export function PlanningPage() {
  return (
    <div className="flex flex-col gap-4">
      <SectionCard
        icon={<ShieldCheck className="h-4 w-4" />}
        title="Water conservation mode"
        description="Water supply is healthy — irrigation runs on its normal schedule."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <MetricCard icon={<CalendarDays className="h-4 w-4" />} label="Days of water remaining" />
        <MetricCard icon={<AlertTriangle className="h-4 w-4" />} label="Water shortage prediction" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SectionCard icon={<CloudSun className="h-4 w-4" />} title="Weather & rainfall outlook" />
        <SectionCard icon={<Leaf className="h-4 w-4" />} title="Projected farm water demand" />
      </div>

      <SectionCard
        icon={<AlertTriangle className="h-4 w-4" />}
        title="Alerts"
        description="No active alerts — water supply is within normal range."
      />
    </div>
  )
}
