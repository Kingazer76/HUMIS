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
import { StatusBadge, shortageTierTone } from '@/components/shared/StatusBadge'
import {
  IrrigationStateIllustration,
  ShortageStateIllustration,
  TankLevelIllustration,
  WeatherIllustration,
} from '@/components/visual/FarmIllustrations'
import { VisualGlance } from '@/components/visual/VisualGlance'
import { usePolling } from '@/hooks/usePolling'
import { api } from '@/lib/api'
import { daysRemainingHint, formatDaysRemainingDisplay, formatLiters, formatRate, formatTierLabel } from '@/lib/format'
import {
  deriveIrrigationVisualState,
  deriveShortageVisualState,
  deriveSoilVisualState,
  deriveTankVisualState,
  deriveWeatherVisualState,
  irrigationVisualHeadline,
  shortageVisualHeadline,
  tankVisualDetail,
  tankVisualHeadline,
  weatherVisualDetail,
  weatherVisualHeadline,
} from '@/lib/visualState'
import { moistureTargetsForZone } from '@aquaflow/shared'

/**
 * Overview with Phase 5 glance pictures. Numbers stay on the card as
 * smaller detail so a farmer can read the picture first.
 */
export function OverviewPage() {
  const { data: water, error: waterError } = usePolling(api.getWater)
  const { data: zones } = usePolling(api.getZones)
  const { data: system } = usePolling(api.getSystem)
  const { data: planning, error: planningError } = usePolling(api.getPlanning)

  const projectedDemandLPerMin =
    zones?.reduce((sum, zone) => sum + zone.nominalOutflowRateLPerMin, 0) ?? undefined

  const fillPct = water ? (water.mainTankL.value / water.tank.capacityL) * 100 : undefined
  const tankVisual =
    fillPct !== undefined && water
      ? deriveTankVisualState(fillPct, water.tank.lowThresholdPct, water.tank.criticalThresholdPct)
      : undefined
  const weatherVisual = system
    ? deriveWeatherVisualState({ isRaining: system.rain.isRaining.value })
    : undefined
  const shortageVisual = planning ? deriveShortageVisualState(planning.tier) : undefined

  const anyIrrigating = zones?.some((z) => z.state.active) ?? false
  const anyNeedsWater =
    zones?.some((z) => {
      const { minPct, maxPct } = moistureTargetsForZone(z)
      return deriveSoilVisualState(z.state.soilMoisturePct.value, minPct, maxPct, z.state.active) === 'dry'
    }) ?? false
  const irrigationVisual = zones
    ? deriveIrrigationVisualState(anyIrrigating, anyNeedsWater)
    : undefined

  const shortageAlert = shortageVisual === 'critical' || shortageVisual === 'high'

  return (
    <div className="flex flex-col gap-4">
      {waterError || planningError ? (
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
          glance={
            tankVisual ? (
              <VisualGlance
                illustration={<TankLevelIllustration state={tankVisual} />}
                headline={tankVisualHeadline(tankVisual)}
                detail={tankVisualDetail(tankVisual)}
              />
            ) : undefined
          }
          value={
            water
              ? `${formatLiters(water.mainTankL.value)} · ${Math.round((water.mainTankL.value / water.tank.capacityL) * 100)}% full`
              : undefined
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
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          icon={<Sprout className="h-4 w-4" />}
          label="Combined zone flow"
          badge={projectedDemandLPerMin !== undefined ? <EstimateBadge tag="estimated" /> : undefined}
          glance={
            irrigationVisual ? (
              <VisualGlance
                illustration={<IrrigationStateIllustration state={irrigationVisual} />}
                headline={irrigationVisualHeadline(irrigationVisual)}
              />
            ) : undefined
          }
          value={projectedDemandLPerMin !== undefined ? formatRate(projectedDemandLPerMin) : undefined}
          hint="Combined flow if every field is watering at once."
        />
        <MetricCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Shortage risk"
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
        <SectionCard icon={<CloudSun className="h-4 w-4" />} title="Weather summary">
          {weatherVisual ? (
            <VisualGlance
              illustration={<WeatherIllustration state={weatherVisual} />}
              headline={weatherVisualHeadline(weatherVisual)}
              detail={
                <>
                  {weatherVisualDetail(weatherVisual)}{' '}
                  {planning
                    ? planning.weatherApplied
                      ? 'A forecast is available and may slightly change days remaining.'
                      : 'Forecast unavailable — days remaining still uses tank water and recent usage.'
                    : null}
                </>
              }
            />
          ) : undefined}
        </SectionCard>
        <SectionCard
          icon={<AlertTriangle className="h-4 w-4" />}
          title="Active alerts"
          description={
            tankVisual === 'critical'
              ? 'The tank is at or below the stop-watering level.'
              : shortageAlert && planning
                ? planning.reason
                : water
                  ? 'No active alerts. All systems normal.'
                  : undefined
          }
        />
      </div>
    </div>
  )
}
