import {
  AlertTriangle,
  CalendarDays,
  CloudSun,
  Droplets,
  Layers,
  Sprout,
  ToggleLeft,
} from 'lucide-react'
import { MetricCard } from '@/components/shared/MetricCard'
import { SectionCard } from '@/components/shared/SectionCard'

/**
 * V1's Overview tab: supply status first, operational status second,
 * context (weather/alerts) last. Phase 0 only lays out the shape —
 * real and simulated data is wired in from Phase 2 onward.
 */
export function OverviewPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard icon={<Droplets className="h-4 w-4" />} label="Main tank level" />
        <MetricCard icon={<Layers className="h-4 w-4" />} label="Available water" />
        <MetricCard icon={<CalendarDays className="h-4 w-4" />} label="Days remaining" />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard icon={<Sprout className="h-4 w-4" />} label="Projected farm demand" />
        <MetricCard icon={<AlertTriangle className="h-4 w-4" />} label="Shortage risk" />
        <MetricCard icon={<ToggleLeft className="h-4 w-4" />} label="Irrigation mode" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SectionCard icon={<CloudSun className="h-4 w-4" />} title="Weather summary" />
        <SectionCard icon={<AlertTriangle className="h-4 w-4" />} title="Active alerts" />
      </div>
    </div>
  )
}
