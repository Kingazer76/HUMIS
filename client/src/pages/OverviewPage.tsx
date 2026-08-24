import {
  AlertTriangle,
  CalendarDays,
  CloudSun,
  Droplets,
  Layers,
  Sprout,
  ToggleLeft,
} from '@/lib/icons'
import { EstimateBadge } from '@/components/shared/EstimateBadge'
import { MetricCard } from '@/components/shared/MetricCard'
import { SectionCard } from '@/components/shared/SectionCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { usePolling } from '@/hooks/usePolling'
import { api } from '@/lib/api'
import { formatLiters, formatRate } from '@/lib/format'

/**
 * V1's Overview tab. Phase 1 wires the numbers this data layer can honestly
 * answer right now (tank/sources/flow, zone read-status, pump/rain/system
 * status). Days remaining and shortage risk need the weather-aware
 * forecasting engine that arrives in Phase 4, so they stay as
 * "not available yet" placeholders rather than guessed numbers.
 */
export function OverviewPage() {
  const { data: water, error: waterError } = usePolling(api.getWater)
  const { data: zones } = usePolling(api.getZones)
  const { data: system } = usePolling(api.getSystem)

  const projectedDemandLPerMin =
    zones?.reduce((sum, zone) => sum + zone.nominalOutflowRateLPerMin, 0) ?? undefined

  return (
    <div className="flex flex-col gap-4">
      {waterError ? (
        <SectionCard
          icon={<AlertTriangle className="h-4 w-4 text-amber-600" />}
          title="Can't reach the AquaFlow server"
          description="Showing the last known state where possible. Retrying automatically."
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          icon={<Droplets className="h-4 w-4" />}
          label="Main tank level"
          badge={water ? <EstimateBadge tag={water.mainTankL.tag} /> : undefined}
          value={water ? formatLiters(water.mainTankL.value) : undefined}
          hint={
            water ? `${Math.round((water.mainTankL.value / water.tank.capacityL) * 100)}% full` : undefined
          }
        />
        <MetricCard
          icon={<Layers className="h-4 w-4" />}
          label="Available water"
          badge={water ? <EstimateBadge tag="simulated" /> : undefined}
          value={water ? formatLiters(water.totalAvailableL.value) : undefined}
          hint="Main tank + transferable sources"
        />
        <MetricCard
          icon={<CalendarDays className="h-4 w-4" />}
          label="Days remaining"
          value="—"
          hint="Needs weather-aware forecasting (Phase 4)"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          icon={<Sprout className="h-4 w-4" />}
          label="Combined zone flow"
          badge={projectedDemandLPerMin !== undefined ? <EstimateBadge tag="estimated" /> : undefined}
          value={projectedDemandLPerMin !== undefined ? formatRate(projectedDemandLPerMin) : undefined}
          hint="Combined nominal flow when all zones are irrigating."
        />
        <MetricCard icon={<AlertTriangle className="h-4 w-4" />} label="Shortage risk" value="—" hint="Arrives in Phase 4" />
        <MetricCard
          icon={<ToggleLeft className="h-4 w-4" />}
          label="Irrigation mode"
          value={system ? (system.system.operationMode === 'auto' ? 'Auto' : 'Manual') : undefined}
          hint={
            system ? (
              <StatusBadge tone={system.system.phase === 'irrigating' ? 'info' : 'neutral'}>
                {system.system.phase.replace('-', ' ')}
              </StatusBadge>
            ) : undefined
          }
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SectionCard icon={<CloudSun className="h-4 w-4" />} title="Weather summary" description="Arrives in Phase 4." />
        <SectionCard
          icon={<AlertTriangle className="h-4 w-4" />}
          title="Active alerts"
          description={
            water && water.mainTankL.value / water.tank.capacityL < water.tank.criticalThresholdPct / 100
              ? 'Tank is at or below the critical threshold.'
              : 'No active alerts. All systems normal.'
          }
        />
      </div>
    </div>
  )
}
