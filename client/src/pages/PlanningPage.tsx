import { AlertTriangle, CalendarDays, CloudSun, Leaf, ShieldCheck } from '@/lib/icons'
import { EstimateBadge } from '@/components/shared/EstimateBadge'
import { MetricCard } from '@/components/shared/MetricCard'
import { SectionCard } from '@/components/shared/SectionCard'
import {
  ShortageStateIllustration,
  TankLevelIllustration,
  WeatherIllustration,
} from '@/components/visual/FarmIllustrations'
import { VisualGlance } from '@/components/visual/VisualGlance'
import { usePolling } from '@/hooks/usePolling'
import { api } from '@/lib/api'
import { daysRemainingHint, formatDaysRemainingDisplay, formatLitersPerDay } from '@/lib/format'
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
  if (dailyL <= 0 && observedDays < 1) return 'Not enough watering data yet.'
  if (dailyL <= 0) {
    return 'Not enough watering data yet.'
  }
  if (observedDays < 1) {
    return 'Not a full day of watering yet — this amount is a rough look at the session so far.'
  }
  if (observedDays < 7) {
    return `Average over ${observedDays.toFixed(1)} days of watering (builds toward a 7-day average).`
  }
  return 'Average watering from the storage tank over the last 7 days.'
}

function alertsCopy(tier: 'low' | 'moderate' | 'high' | 'critical'): string {
  if (tier === 'critical' || tier === 'high') return shortageVisualHeadline(tier)
  return 'No active alerts. Water looks fine.'
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
    <div className="flex flex-col gap-5">
      {planningError ? (
        <SectionCard
          icon={<AlertTriangle className="h-4 w-4 text-warning" />}
          title="Can't reach the AquaFlow server"
          description="Planning numbers will appear once the connection is back. Retrying automatically."
        />
      ) : null}

      <SectionCard icon={<ShieldCheck className="h-4 w-4" />} title="Water level">
        {tankVisual ? (
          <VisualGlance
            illustration={<TankLevelIllustration state={tankVisual} fillPct={fillPct} />}
            headline={tankVisualHeadline(tankVisual)}
            detail={tankVisualDetail(tankVisual)}
          />
        ) : (
          <p className="text-sm text-muted-foreground">Loading water level…</p>
        )}
      </SectionCard>

      <div className="grid gap-5 sm:grid-cols-2">
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
          label="Water outlook"
          glance={
            shortageVisual ? (
              <VisualGlance
                illustration={<ShortageStateIllustration tier={shortageVisual} />}
                headline={shortageVisualHeadline(shortageVisual)}
              />
            ) : undefined
          }
          hint={planning?.reason}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <SectionCard icon={<CloudSun className="h-4 w-4" />} title="Rain and weather">
          {weatherVisual ? (
            <VisualGlance
              illustration={<WeatherIllustration state={weatherVisual} />}
              headline={weatherVisualHeadline(weatherVisual)}
              detail={
                <>
                  {weatherVisualDetail(weatherVisual)}{' '}
                  {planning
                    ? planning.weatherApplied
                      ? 'Rain chance is included and may slightly change days remaining.'
                      : 'Days remaining still uses stored water and recent watering.'
                    : null}
                </>
              }
            />
          ) : undefined}
        </SectionCard>
        <MetricCard
          icon={<Leaf className="h-4 w-4" />}
          label="Water used each day"
          badge={planning ? <EstimateBadge tag={planning.sevenDayAverageConsumptionL.tag} /> : undefined}
          value={planning ? formatLitersPerDay(planning.sevenDayAverageConsumptionL.value) : undefined}
          hint={planning ? consumptionHint(planning.observedDays, planning.sevenDayAverageConsumptionL.value) : undefined}
        />
      </div>

      <SectionCard
        icon={<AlertTriangle className="h-4 w-4" />}
        title="Alerts"
        description={planning ? alertsCopy(planning.tier) : undefined}
      />

      <p className="text-xs text-muted-foreground">
        Predictions are estimates from this simulated farm and are not guaranteed. Days remaining uses
        stored tank water only (fields never drink from the other water sources) divided by recent watering.
      </p>
    </div>
  )
}
