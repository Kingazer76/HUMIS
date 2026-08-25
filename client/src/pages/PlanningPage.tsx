import { AlertTriangle, CalendarDays, CloudSun, Leaf, ShieldCheck } from '@/lib/icons'
import { EstimateBadge } from '@/components/shared/EstimateBadge'
import { MetricCard } from '@/components/shared/MetricCard'
import { SectionCard } from '@/components/shared/SectionCard'
import { StatusBadge, shortageTierTone } from '@/components/shared/StatusBadge'
import {
  ShortageStateIllustration,
  TankLevelIllustration,
  WeatherIllustration,
} from '@/components/visual/FarmIllustrations'
import { VisualGlance } from '@/components/visual/VisualGlance'
import { usePolling } from '@/hooks/usePolling'
import { api } from '@/lib/api'
import { daysRemainingHint, formatDaysRemainingDisplay, formatLitersPerDay, formatTierLabel } from '@/lib/format'
import {
  deriveShortageVisualState,
  deriveTankVisualState,
  deriveWeatherVisualState,
  shortageVisualHeadline,
  tankVisualDetail,
  tankVisualHeadline,
  weatherVisualDetail,
  weatherVisualHeadline,
} from '@/lib/visualState'

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
 * Planning tab. Shortage and weather pictures reuse the same prediction
 * and rain reading as Overview — they do not compute a second forecast.
 */
export function PlanningPage() {
  const { data: planning, error: planningError } = usePolling(api.getPlanning)
  const { data: water } = usePolling(api.getWater)
  const { data: system } = usePolling(api.getSystem)

  const fillPct = water ? (water.mainTankL.value / water.tank.capacityL) * 100 : undefined
  const tankVisual =
    fillPct !== undefined && water
      ? deriveTankVisualState(fillPct, water.tank.lowThresholdPct, water.tank.criticalThresholdPct)
      : undefined
  const weatherVisual = system
    ? deriveWeatherVisualState({ isRaining: system.rain.isRaining.value })
    : undefined
  const shortageVisual = planning ? deriveShortageVisualState(planning.tier) : undefined

  return (
    <div className="flex flex-col gap-4">
      {planningError ? (
        <SectionCard
          icon={<AlertTriangle className="h-4 w-4 text-amber-600" />}
          title="Can't reach the AquaFlow server"
          description="Planning numbers will appear once the connection is back. Retrying automatically."
        />
      ) : null}

      <SectionCard icon={<ShieldCheck className="h-4 w-4" />} title="Water conservation mode">
        {tankVisual ? (
          <VisualGlance
            illustration={<TankLevelIllustration state={tankVisual} />}
            headline={tankVisualHeadline(tankVisual)}
            detail={tankVisualDetail(tankVisual)}
          />
        ) : (
          <p className="text-sm text-muted-foreground">Loading tank status…</p>
        )}
      </SectionCard>

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
          glance={
            shortageVisual ? (
              <VisualGlance
                illustration={<ShortageStateIllustration tier={shortageVisual} />}
                headline={shortageVisualHeadline(shortageVisual)}
              />
            ) : undefined
          }
          value={planning ? formatTierLabel(planning.tier) : undefined}
          hint={planning?.reason}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SectionCard icon={<CloudSun className="h-4 w-4" />} title="Weather & rainfall outlook">
          {weatherVisual ? (
            <VisualGlance
              illustration={<WeatherIllustration state={weatherVisual} />}
              headline={weatherVisualHeadline(weatherVisual)}
              detail={
                <>
                  {weatherVisualDetail(weatherVisual)}{' '}
                  {planning
                    ? planning.weatherApplied
                      ? 'A forecast is available. If rainfall changes the usage rate, days remaining will show it.'
                      : 'Forecast unavailable. Shortage prediction still uses tank water and rolling usage — weather is never required.'
                    : null}
                </>
              }
            />
          ) : undefined}
        </SectionCard>
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
