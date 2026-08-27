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
import { StatusBadge, shortageTierTone, type StatusTone } from '@/components/shared/StatusBadge'
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
import { statusHeadlineClass } from '@/lib/statusTone'
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
  type IrrigationVisualState,
  type TankVisualState,
  type WeatherVisualState,
} from '@/lib/visualState'
import { moistureTargetsForZone, type ShortageTier } from '@aquaflow/shared'

function tankTone(state: TankVisualState | undefined): StatusTone {
  if (state === 'critical') return 'critical'
  if (state === 'low') return 'warning'
  if (state === 'high') return 'good'
  return 'neutral'
}

function irrigationTone(state: IrrigationVisualState | undefined): StatusTone {
  if (state === 'needs-attention') return 'warning'
  if (state === 'running') return 'info'
  if (state === 'healthy') return 'good'
  return 'neutral'
}

function weatherTone(state: WeatherVisualState | undefined): StatusTone {
  if (state === 'hot-dry') return 'warning'
  if (state === 'rain') return 'info'
  if (state === 'normal') return 'good'
  return 'neutral'
}

function daysTone(
  tier: ShortageTier | undefined,
  hasUsage: boolean,
): StatusTone {
  if (!hasUsage) return 'neutral'
  return tier ? shortageTierTone(tier) : 'neutral'
}

function wateringStatusTone(phase: string | undefined, isIrrigating: boolean): StatusTone {
  if (isIrrigating || phase === 'irrigating') return 'info'
  if (phase === 'low-water') return 'warning'
  return 'neutral'
}

/**
 * Overview glance layout. Same farm numbers as before — only the order,
 * size, and healthy/warning/critical colors changed so a farmer can scan
 * water, crops, weather, shortage, days left, and watering status quickly.
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
  const hasUsage = (planning?.sevenDayAverageConsumptionL.value ?? 0) > 0
  const waterTone = tankTone(tankVisual)
  const riskTone = shortageVisual ? shortageTierTone(shortageVisual) : 'neutral'
  const cropTone = irrigationTone(irrigationVisual)
  const rainTone = weatherTone(weatherVisual)
  const remainingTone = daysTone(planning?.tier, hasUsage)
  const wateringTone = wateringStatusTone(system?.system.phase, anyIrrigating)

  const alertTone: StatusTone =
    tankVisual === 'critical' ? 'critical' : shortageAlert ? riskTone : water ? 'good' : 'neutral'
  const alertText =
    tankVisual === 'critical'
      ? 'Water level is too low. New watering will not start.'
      : shortageAlert && planning
        ? shortageVisualHeadline(planning.tier)
        : water
          ? 'No active alerts. Water and fields look normal.'
          : undefined

  return (
    <div className="flex flex-col gap-5">
      {waterError || planningError ? (
        <SectionCard
          tone="warning"
          icon={<AlertTriangle className="h-4 w-4" />}
          title="Can't reach the AquaFlow server"
          description="Showing the last known state where possible. Retrying automatically."
        />
      ) : null}

      {/* Water, days left, shortage — the three “do I have a problem?” facts */}
      <div className="grid gap-5 sm:grid-cols-3">
        <MetricCard
          tone={waterTone}
          icon={<Droplets className="h-4 w-4" />}
          label="Water level"
          badge={water ? <EstimateBadge tag={water.mainTankL.tag} /> : undefined}
          glance={
            tankVisual ? (
              <VisualGlance
                tone={waterTone}
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
          tone={remainingTone}
          emphasize
          icon={<CalendarDays className="h-4 w-4" />}
          label="Days remaining"
          badge={hasUsage && planning ? <EstimateBadge tag={planning.daysRemaining.tag} /> : undefined}
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
          tone={riskTone}
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Water outlook"
          glance={
            shortageVisual ? (
              <VisualGlance
                tone={riskTone}
                illustration={<ShortageStateIllustration tier={shortageVisual} />}
                headline={shortageVisualHeadline(shortageVisual)}
              />
            ) : undefined
          }
          hint={planning?.reason}
        />
      </div>

      {/* Crops, weather, watering — what to do next */}
      <div className="grid gap-5 sm:grid-cols-3">
        <MetricCard
          tone={cropTone}
          icon={<Sprout className="h-4 w-4" />}
          label="Crops and soil"
          badge={projectedDemandLPerMin !== undefined ? <EstimateBadge tag="estimated" /> : undefined}
          glance={
            irrigationVisual ? (
              <VisualGlance
                tone={cropTone}
                illustration={<IrrigationStateIllustration state={irrigationVisual} />}
                headline={irrigationVisualHeadline(irrigationVisual)}
              />
            ) : undefined
          }
          value={projectedDemandLPerMin !== undefined ? formatRate(projectedDemandLPerMin) : undefined}
        />
        <MetricCard
          tone={rainTone}
          icon={<CloudSun className="h-4 w-4" />}
          label="Rain and weather"
          badge={system ? <EstimateBadge tag={system.rain.isRaining.tag} /> : undefined}
          glance={
            weatherVisual ? (
              <VisualGlance
                tone={rainTone}
                illustration={<WeatherIllustration state={weatherVisual} />}
                headline={weatherVisualHeadline(weatherVisual)}
                detail={
                  <>
                    {weatherVisualDetail(weatherVisual)} Farm rain sensor — rain fills the main tank. Not the Planning forecast.
                  </>
                }
              />
            ) : undefined
          }
        />
        <MetricCard
          tone={wateringTone}
          icon={<ToggleLeft className="h-4 w-4" />}
          label="Watering status"
          value={system ? formatSystemPhase(system.system.phase) : undefined}
          hint={
            system ? (
              <span className="flex flex-wrap items-center gap-2">
                <StatusBadge tone={wateringTone === 'info' ? 'info' : 'neutral'}>
                  {system.system.operationMode === 'auto' ? 'Auto' : 'Manual'}
                </StatusBadge>
              </span>
            ) : undefined
          }
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <MetricCard
          icon={<Layers className="h-4 w-4" />}
          label="Available water"
          badge={water ? <EstimateBadge tag="simulated" /> : undefined}
          value={water ? formatLiters(water.totalAvailableL.value) : undefined}
          hint="Water currently stored in the main tank"
        />
        <SectionCard
          tone={alertTone}
          icon={<AlertTriangle className="h-4 w-4" />}
          title="Active alerts"
        >
          {alertText ? (
            <p className={`text-lg font-semibold leading-snug ${statusHeadlineClass(alertTone)}`}>
              {alertText}
            </p>
          ) : null}
        </SectionCard>
      </div>
    </div>
  )
}
