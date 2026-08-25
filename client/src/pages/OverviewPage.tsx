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
import {
  IrrigationStateIllustration,
  ShortageStateIllustration,
  TankLevelIllustration,
  WeatherIllustration,
} from '@/components/visual/FarmIllustrations'
import { VisualGlance } from '@/components/visual/VisualGlance'
import { usePolling } from '@/hooks/usePolling'
import { api } from '@/lib/api'
import { daysRemainingHint, formatDaysRemainingDisplay, formatLiters, formatRate } from '@/lib/format'
import {
  deriveIrrigationVisualState,
  deriveShortageVisualState,
  deriveSoilVisualState,
  deriveTankVisualState,
  deriveWeatherVisualState,
  formatSystemPhase,
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
          label="Water level"
          badge={water ? <EstimateBadge tag={water.mainTankL.tag} /> : undefined}
          glance={
            tankVisual ? (
              <VisualGlance
                illustration={<TankLevelIllustration state={tankVisual} fillPct={fillPct} />}
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
          hint="Stored water plus other sources"
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
          label="Field watering"
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
          hint="How much water would flow if every field watered at once."
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
        <MetricCard
          icon={<ToggleLeft className="h-4 w-4" />}
          label="Watering mode"
          value={system ? (system.system.operationMode === 'auto' ? 'Auto' : 'Manual') : undefined}
          hint={
            system ? (
              <StatusBadge tone={system.system.phase === 'irrigating' ? 'info' : 'neutral'}>
                {formatSystemPhase(system.system.phase)}
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
                      ? 'Rain chance is included and may slightly change days remaining.'
                      : 'Days remaining still uses stored water and recent watering.'
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
              ? 'Water level is too low. New watering will not start.'
              : shortageAlert && planning
                ? shortageVisualHeadline(planning.tier)
                : water
                  ? 'No active alerts. Water and fields look normal.'
                  : undefined
          }
        />
      </div>
    </div>
  )
}
