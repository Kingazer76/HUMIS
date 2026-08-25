import { AlertTriangle, CalendarDays, CloudSun, Leaf, ShieldCheck } from '@/lib/icons'
import { EstimateBadge } from '@/components/shared/EstimateBadge'
import { MetricCard } from '@/components/shared/MetricCard'
import { SectionCard } from '@/components/shared/SectionCard'
import { StatusBadge, shortageTierTone } from '@/components/shared/StatusBadge'
import { usePolling } from '@/hooks/usePolling'
import { api } from '@/lib/api'
import { daysRemainingHint, formatDaysRemainingDisplay, formatLitersPerDay, formatTierLabel } from '@/lib/format'

function consumptionHint(observedDays: number, dailyL: number): string {
  if (dailyL <= 0 && observedDays < 1) return 'No irrigation use recorded yet this session.'
  if (dailyL <= 0) {
    return `No irrigation use over ${observedDays.toFixed(1)} observed simulated days.`
  }
  if (observedDays < 1) {
    return 'Not a full simulated day of usage yet — this rate is extrapolated from the session so far.'
  }
  if (observedDays < 7) {
    return `Average over ${observedDays.toFixed(1)} observed simulated days (builds toward a 7-day average).`
  }
  return '7-day rolling average of irrigation use from the main tank.'
}

function alertsCopy(tier: string, reason: string): string {
  if (tier === 'critical' || tier === 'high') return reason
  return 'No active alerts — water supply is within normal range.'
}

/**
 * V1's Planning tab. Days remaining, shortage prediction, and the 7-day
 * usage average are wired to Phase 4's `shortagePrediction` (the same
 * GET /api/planning data Overview uses). Conservation mode stays a
 * placeholder until Settings exists.
 */
export function PlanningPage() {
  const { data: planning, error: planningError } = usePolling(api.getPlanning)

  return (
    <div className="flex flex-col gap-4">
      {planningError ? (
        <SectionCard
          icon={<AlertTriangle className="h-4 w-4 text-amber-600" />}
          title="Can't reach the AquaFlow server"
          description="Planning numbers will appear once the connection is back. Retrying automatically."
        />
      ) : null}

      <SectionCard
        icon={<ShieldCheck className="h-4 w-4" />}
        title="Water conservation mode"
        description="Water supply is healthy — irrigation runs on its normal schedule."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <MetricCard
          icon={<CalendarDays className="h-4 w-4" />}
          label="Days of water remaining"
          badge={
            planning && planning.sevenDayAverageConsumptionL.value > 0 ? (
              <EstimateBadge tag={planning.daysRemaining.tag} />
            ) : undefined
          }
          value={
            planning
              ? formatDaysRemainingDisplay(
                  planning.daysRemaining.value,
                  planning.sevenDayAverageConsumptionL.value,
                )
              : undefined
          }
          hint={
            planning
              ? daysRemainingHint(
                  planning.sevenDayAverageConsumptionL.value,
                  planning.weatherApplied,
                )
              : undefined
          }
        />
        <MetricCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Water shortage prediction"
          badge={planning ? <StatusBadge tone={shortageTierTone(planning.tier)}>{planning.tier}</StatusBadge> : undefined}
          value={planning ? formatTierLabel(planning.tier) : undefined}
          hint={planning?.reason}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SectionCard
          icon={<CloudSun className="h-4 w-4" />}
          title="Weather & rainfall outlook"
          description={
            planning
              ? planning.weatherApplied
                ? 'A weather forecast is available. If rainfall changes the usage rate, days remaining will show it. If weather drops out, planning still runs from tank level and usage alone.'
                : 'Weather forecast unavailable. Shortage prediction is using main-tank water and rolling usage only — weather is never required.'
              : undefined
          }
        />
        <MetricCard
          icon={<Leaf className="h-4 w-4" />}
          label="Projected farm water demand"
          badge={planning ? <EstimateBadge tag={planning.sevenDayAverageConsumptionL.tag} /> : undefined}
          value={planning ? formatLitersPerDay(planning.sevenDayAverageConsumptionL.value) : undefined}
          hint={planning ? consumptionHint(planning.observedDays, planning.sevenDayAverageConsumptionL.value) : undefined}
        />
      </div>

      <SectionCard
        icon={<AlertTriangle className="h-4 w-4" />}
        title="Alerts"
        description={planning ? alertsCopy(planning.tier, planning.reason) : undefined}
      />

      <p className="text-xs text-muted-foreground">
        Predictions are estimates from simulated data and are not guaranteed. Days remaining uses
        main-tank water only (irrigation never draws from external sources) divided by the rolling
        usage rate.
      </p>
    </div>
  )
}
