import { AlertTriangle, CalendarDays, CloudSun, Leaf, ShieldCheck } from '@/lib/icons'
import type { IrrigationAdviceStatus, WeatherForecastSnapshot } from '@aquaflow/shared'
import { EstimateBadge } from '@/components/shared/EstimateBadge'
import { MetricCard } from '@/components/shared/MetricCard'
import { SectionCard } from '@/components/shared/SectionCard'
import { StatusBadge, type StatusTone } from '@/components/shared/StatusBadge'
import {
  ShortageStateIllustration,
  TankLevelIllustration,
  WeatherIllustration,
} from '@/components/visual/FarmIllustrations'
import { VisualGlance } from '@/components/visual/VisualGlance'
import { usePolling } from '@/hooks/usePolling'
import { api } from '@/lib/api'
import { daysRemainingHint, formatDaysRemainingDisplay, formatIrrigationAdviceStatus, formatLiters, formatLitersPerDay, formatMm, formatNextCheckHours, formatPercent, formatTemperatureC } from '@/lib/format'
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

function formatForecastDay(date: string): string {
  const parsed = new Date(`${date}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

function WeatherPlanningSection({
  weather,
  weatherApplied,
  loading,
}: {
  weather: WeatherForecastSnapshot | undefined
  weatherApplied: boolean | undefined
  loading: boolean
}) {
  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading the weather forecast…</p>
  }
  if (!weather?.available || !weather.condition) {
    return (
      <p className="text-sm text-muted-foreground">
        {weather?.reason ??
          "Can't load the weather forecast right now. Days remaining still uses stored water and recent watering."}
      </p>
    )
  }

  const weatherVisual = deriveWeatherVisualState({
    isRaining: weather.condition === 'rain',
    condition: weather.condition,
  })
  const place = weather.location?.label
  const temp = weather.temperatureC ? formatTemperatureC(weather.temperatureC.value) : undefined
  const humidity = weather.humidityPct ? formatPercent(weather.humidityPct.value) : undefined
  const chance = weather.precipitationProbabilityPct
    ? formatPercent(weather.precipitationProbabilityPct.value)
    : undefined

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <EstimateBadge tag="forecast" />
      </div>
      <VisualGlance
        illustration={<WeatherIllustration state={weatherVisual} />}
        headline={weatherVisualHeadline(weatherVisual, 'forecast')}
        detail={
          <>
            {weatherVisualDetail(weatherVisual, 'forecast')}{' '}
            {weatherApplied
              ? 'Rain chance is included and may slightly change days remaining.'
              : 'Days remaining still uses stored water and recent watering.'}
          </>
        }
      />
      <p className="text-sm text-foreground">
        {[temp, humidity ? `Humidity ${humidity}` : undefined, chance ? `Rain chance ${chance}` : undefined]
          .filter(Boolean)
          .join(' · ')}
      </p>
      <p className="text-[11px] text-muted-foreground/70">
        Open-Meteo forecast{place ? ` for ${place}` : ''}. This is not the simulated farm rain sensor.
      </p>
      {weather.days && weather.days.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {weather.days.map((day) => (
            <div key={day.date} className="flex justify-between gap-3 text-sm text-muted-foreground">
              <span>{formatForecastDay(day.date)}</span>
              <span className="tabular-nums text-foreground">
                {formatTemperatureC(day.temperatureMinC.value)}–{formatTemperatureC(day.temperatureMaxC.value)}
                {' · '}
                {formatPercent(day.precipitationProbabilityPct.value)} rain
                {' · '}
                {formatMm(day.precipitationMm.value)}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function adviceTone(status: IrrigationAdviceStatus): StatusTone {
  if (status === 'no-irrigation-needed') return 'good'
  if (status === 'monitor') return 'info'
  if (status === 'irrigation-recommended') return 'warning'
  if (status === 'irrigation-urgent') return 'critical'
  if (status === 'irrigation-limited-by-water') return 'warning'
  return 'neutral'
}

/**
 * Planning tab. Shortage pictures reuse the same prediction as Overview.
 * Rain and weather on this page comes from the live Open-Meteo forecast,
 * not from the simulated farm rain sensor.
 */
export function PlanningPage() {
  const { data: planning, error: planningError } = usePolling(api.getPlanning)
  const { data: water } = usePolling(api.getWater)
  const { data: advice } = usePolling(api.getIrrigationAdvice)

  const fillPct = water ? (water.mainTankL.value / water.tank.capacityL) * 100 : undefined
  const tankVisual =
    fillPct !== undefined && water
      ? deriveTankVisualState(fillPct, water.tank.lowThresholdPct, water.tank.criticalThresholdPct)
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
          <WeatherPlanningSection
            weather={planning?.weather}
            weatherApplied={planning?.weatherApplied}
            loading={!planning && !planningError}
          />
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
        icon={<Leaf className="h-4 w-4" />}
        title="Field watering advice"
        description="Same crop, soil, weather, and tank rules as automatic watering. This does not open valves by itself."
      >
        {advice?.zones && advice.zones.length > 0 ? (
          <div className="flex flex-col divide-y divide-border">
            {advice.zones.map((zone) => (
              <div key={zone.zoneId} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{zone.zoneName}</p>
                  <StatusBadge tone={adviceTone(zone.status)}>
                    {formatIrrigationAdviceStatus(zone.status)}
                  </StatusBadge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Crop: {zone.cropName} · Soil: {zone.soilName} · Growth stage: {zone.growthStageName}
                </p>
                <p className="text-sm text-foreground">{zone.reason}</p>
                <p className="text-[11px] text-muted-foreground/70">
                  About {formatLiters(zone.estimatedNeedL)} needed · tank has {formatLiters(zone.availableTankL)} ·{' '}
                  {formatNextCheckHours(zone.nextCheckHours)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Loading field watering advice…</p>
        )}
      </SectionCard>

      <SectionCard
        icon={<AlertTriangle className="h-4 w-4" />}
        title="Alerts"
        description={planning ? alertsCopy(planning.tier) : undefined}
      />

      <p className="text-xs text-muted-foreground">
        Predictions are estimates from this simulated farm and are not guaranteed. Days remaining uses
        stored tank water only (fields never drink from the other water sources) divided by recent watering.
        Rain and weather on this page is a real forecast. Tank, soil, and the farm rain sensor stay simulated.
      </p>
    </div>
  )
}
