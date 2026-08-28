import { useState } from 'react'
import { Activity, CloudRain, Database, Plus, Power, Settings2, Sprout } from '@/lib/icons'
import {
  getSoil,
  moistureTargetsForZone,
  type IrrigationAdviceStatus,
  type IrrigationZone,
  type OperationMode,
  type ZoneIrrigationAdvice,
} from '@aquaflow/shared'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { EstimateBadge } from '@/components/shared/EstimateBadge'
import { MetricCard } from '@/components/shared/MetricCard'
import { SectionCard } from '@/components/shared/SectionCard'
import { StatusBadge, type StatusTone } from '@/components/shared/StatusBadge'
import { SoilStateIllustration, TankLevelIllustration, WeatherIllustration } from '@/components/visual/FarmIllustrations'
import { VisualGlance } from '@/components/visual/VisualGlance'
import { usePolling } from '@/hooks/usePolling'
import { api } from '@/lib/api'
import { formatIrrigationAdviceStatus, formatIrrigationPreference, formatLiters, formatNextCheckHours, formatPercent } from '@/lib/format'
import {
  deriveIrrigationVisualState,
  deriveSoilVisualState,
  deriveTankVisualState,
  deriveWeatherVisualState,
  formatSystemPhase,
  irrigationVisualHeadline,
  soilVisualDetail,
  soilVisualHeadline,
  tankVisualHeadline,
  weatherVisualHeadline,
} from '@/lib/visualState'

interface ZoneCardProps {
  zone: IrrigationZone
  advice: ZoneIrrigationAdvice | undefined
  pending: boolean
  actionError: string | undefined
  onToggle: (zone: IrrigationZone) => void
}

function adviceTone(status: IrrigationAdviceStatus): StatusTone {
  if (status === 'no-irrigation-needed') return 'good'
  if (status === 'monitor') return 'info'
  if (status === 'irrigation-recommended') return 'warning'
  if (status === 'irrigation-urgent') return 'critical'
  if (status === 'irrigation-limited-by-water') return 'warning'
  return 'neutral'
}

function growthStageName(zone: IrrigationZone): string {
  return (
    zone.crop.stages?.find((s) => s.id === zone.growthStageId)?.name ??
    zone.crop.stages?.find((s) => s.id === 'mid')?.name ??
    'Mid-season'
  )
}

function ZoneCard({ zone, advice, pending, actionError, onToggle }: ZoneCardProps) {
  const { minPct, maxPct } = moistureTargetsForZone(zone)
  const moisture = zone.state.soilMoisturePct.value
  const soilVisual = deriveSoilVisualState(moisture, minPct, maxPct, zone.state.active)
  const irrigationVisual = deriveIrrigationVisualState(zone.state.active, soilVisual === 'dry')
  const inRange = soilVisual === 'healthy'
  const soilName = advice?.soilName ?? getSoil(zone.soilId).name
  const stageName = advice?.growthStageName ?? growthStageName(zone)

  return (
    <Card className="gap-3">
      <CardHeader className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Sprout className="h-4 w-4 text-primary" />
            {zone.name}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Crop: {zone.crop.name} · Soil: {soilName} · Growth stage: {stageName}
          </p>
          <p className="text-[11px] text-muted-foreground/70">
            {formatIrrigationPreference(zone.irrigationPreference)}
          </p>
        </div>
        <StatusBadge tone={zone.state.active ? 'info' : inRange ? 'good' : 'warning'}>
          {irrigationVisualHeadline(irrigationVisual)}
        </StatusBadge>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <VisualGlance
          illustration={<SoilStateIllustration state={soilVisual} />}
          headline={soilVisualHeadline(soilVisual)}
          detail={soilVisualDetail(soilVisual)}
        />
        {advice ? (
          <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">Irrigation status</span>
              <StatusBadge tone={adviceTone(advice.status)}>
                {formatIrrigationAdviceStatus(advice.status)}
              </StatusBadge>
            </div>
            <p className="text-sm text-foreground">{advice.reason}</p>
            <p className="text-[11px] text-muted-foreground/70">
              About {formatLiters(advice.estimatedNeedL)} needed to refill · tank has{' '}
              {formatLiters(advice.availableTankL)} · {formatNextCheckHours(advice.nextCheckHours)}
            </p>
          </div>
        ) : null}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            How wet
            <EstimateBadge tag={zone.state.soilMoisturePct.tag} />
          </span>
          <span className="font-medium text-foreground">{formatPercent(moisture)}</span>
        </div>
        <Progress value={moisture} />
        <div className="flex justify-between text-[11px] text-muted-foreground/70">
          <span>0%</span>
          <span>
            usual range {minPct}-{maxPct}%
          </span>
          <span>100%</span>
        </div>
        <p className="text-[11px] text-muted-foreground/70">
          {zone.sensorMode === 'default' ? 'Usual soil reading' : 'Custom soil reading'}
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" variant="outline" disabled title="Zone editing is not yet implemented">
            Edit
          </Button>
          <Button
            size="sm"
            variant={zone.state.active ? 'outline' : 'default'}
            disabled={pending}
            onClick={() => onToggle(zone)}
          >
            {pending ? 'Working…' : zone.state.active ? 'Stop' : 'Water now'}
          </Button>
          <Button size="sm" variant="outline" disabled title="Zone editing is not yet implemented">
            Reset
          </Button>
        </div>
        {actionError ? <p className="text-xs text-destructive">{actionError}</p> : null}
      </CardContent>
    </Card>
  )
}

interface ActionState {
  pending: boolean
  error?: string
}

const IDLE: ActionState = { pending: false }

/**
 * V1's Irrigation tab, now with real actuation (Phase 3). Every button here
 * calls `safetyController` through `/api/irrigation/*` — never the device
 * provider directly — so the exact same tank-critical/stale-reading/
 * debounce interlocks apply to a manual click as to the automatic
 * hysteresis loop running on the server. Zone editing/adding remains out of
 * scope for this phase.
 */
export function IrrigationPage() {
  const zonesPolling = usePolling(api.getZones)
  const waterPolling = usePolling(api.getWater)
  const systemPolling = usePolling(api.getSystem)
  const advicePolling = usePolling(api.getIrrigationAdvice)
  const { data: zones } = zonesPolling
  const { data: water } = waterPolling
  const { data: system } = systemPolling
  const { data: advice } = advicePolling

  const [zoneActions, setZoneActions] = useState<Record<string, ActionState>>({})
  const [pumpAction, setPumpAction] = useState<ActionState>(IDLE)
  const [modeAction, setModeAction] = useState<ActionState>(IDLE)

  async function refreshAll() {
    await Promise.all([
      zonesPolling.refetch(),
      systemPolling.refetch(),
      waterPolling.refetch(),
      advicePolling.refetch(),
    ])
  }

  async function handleZoneToggle(zone: IrrigationZone) {
    setZoneActions((s) => ({ ...s, [zone.id]: { pending: true } }))
    try {
      const result = zone.state.active ? await api.stopZone(zone.id) : await api.startZone(zone.id)
      setZoneActions((s) => ({ ...s, [zone.id]: { pending: false, error: result.ok ? undefined : result.reason } }))
      await refreshAll()
    } catch {
      setZoneActions((s) => ({ ...s, [zone.id]: { pending: false, error: 'Request failed — please try again.' } }))
    }
  }

  async function handlePumpToggle(isOn: boolean) {
    setPumpAction({ pending: true })
    try {
      const result = await api.setPumpState(isOn)
      setPumpAction({ pending: false, error: result.ok ? undefined : result.reason })
      await refreshAll()
    } catch {
      setPumpAction({ pending: false, error: 'Request failed — please try again.' })
    }
  }

  async function handleModeChange(mode: OperationMode) {
    if (system?.system.operationMode === mode) return
    setModeAction({ pending: true })
    try {
      const result = await api.setOperationMode(mode)
      setModeAction({ pending: false, error: result.ok ? undefined : result.reason })
      await refreshAll()
    } catch {
      setModeAction({ pending: false, error: 'Request failed — please try again.' })
    }
  }

  const avgMoisture =
    zones && zones.length > 0
      ? zones.reduce((sum, z) => sum + z.state.soilMoisturePct.value, 0) / zones.length
      : undefined
  const tankFillPct = water ? (water.mainTankL.value / water.tank.capacityL) * 100 : undefined
  const tankVisual =
    tankFillPct !== undefined && water
      ? deriveTankVisualState(tankFillPct, water.tank.lowThresholdPct, water.tank.criticalThresholdPct)
      : undefined
  const weatherVisual = system
    ? deriveWeatherVisualState({ isRaining: system.rain.isRaining.value })
    : undefined
  const farmSoilVisual = zones
    ? zones.some((z) => z.state.active)
      ? 'irrigating'
      : zones.some((z) => {
          const { minPct, maxPct } = moistureTargetsForZone(z)
          return deriveSoilVisualState(z.state.soilMoisturePct.value, minPct, maxPct, false) === 'dry'
        })
        ? 'dry'
        : 'healthy'
    : undefined
  const isManual = system?.system.operationMode === 'manual'

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-3">
        <MetricCard
          icon={<Sprout className="h-4 w-4" />}
          label="Soil"
          glance={
            farmSoilVisual ? (
              <VisualGlance
                illustration={<SoilStateIllustration state={farmSoilVisual} />}
                headline={soilVisualHeadline(farmSoilVisual)}
              />
            ) : undefined
          }
          value={avgMoisture !== undefined ? `Average ${formatPercent(avgMoisture)}` : undefined}
          hint={
            zones ? (
              <span className="flex items-center gap-1.5">
                Across all fields <EstimateBadge tag={zones[0]?.state.soilMoisturePct.tag ?? 'simulated'} />
              </span>
            ) : undefined
          }
        />
        <MetricCard
          icon={<Database className="h-4 w-4" />}
          label="Water level"
          glance={
            tankVisual ? (
              <VisualGlance
                illustration={<TankLevelIllustration state={tankVisual} fillPct={tankFillPct} />}
                headline={tankVisualHeadline(tankVisual)}
              />
            ) : undefined
          }
          value={tankFillPct !== undefined ? formatPercent(tankFillPct) : undefined}
          hint={water ? <EstimateBadge tag={water.mainTankL.tag} /> : undefined}
        />
        <MetricCard
          icon={<CloudRain className="h-4 w-4" />}
          label="Rain"
          badge={
            system ? (
              <StatusBadge tone={system.rain.isRaining.value ? 'info' : 'neutral'}>
                {weatherVisualHeadline(weatherVisual ?? 'normal')}
              </StatusBadge>
            ) : undefined
          }
          glance={
            weatherVisual ? (
              <VisualGlance
                illustration={<WeatherIllustration state={weatherVisual} />}
                headline={weatherVisualHeadline(weatherVisual)}
              />
            ) : undefined
          }
          value={system ? (system.rain.isRaining.value ? 'Rain detected' : 'No rain') : undefined}
          hint={
            system ? (
              <>
                <EstimateBadge tag={system.rain.isRaining.tag} />
                <span> Rain fills the main tank</span>
              </>
            ) : undefined
          }
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <SectionCard icon={<Power className="h-4 w-4" />} title="Water flow">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-primary">
              <Power className="h-4 w-4" />
            </span>
            <div>
              <div className="font-medium text-foreground">
                {system ? (system.pump.isOn.value ? 'Watering now' : 'Not watering') : <Skeleton className="h-4 w-24" />}
              </div>
              <p className="text-xs text-muted-foreground">
                {system ? (system.pump.isOn.value ? 'Water flowing' : 'No water flowing') : null}
              </p>
            </div>
          </div>
        </SectionCard>
        <SectionCard icon={<Activity className="h-4 w-4" />} title="What the farm is doing">
          <StatusBadge tone={system?.system.phase === 'irrigating' ? 'info' : 'neutral'}>
            {system ? formatSystemPhase(system.system.phase) : '—'}
          </StatusBadge>
        </SectionCard>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <SectionCard icon={<Settings2 className="h-4 w-4" />} title="Watering mode">
          <div className="flex gap-2">
            <Button
              className="flex-1"
              disabled={modeAction.pending}
              variant={system?.system.operationMode === 'auto' ? 'default' : 'outline'}
              onClick={() => handleModeChange('auto')}
            >
              Auto
            </Button>
            <Button
              className="flex-1"
              disabled={modeAction.pending}
              variant={system?.system.operationMode === 'manual' ? 'default' : 'outline'}
              onClick={() => handleModeChange('manual')}
            >
              Manual
            </Button>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {isManual
              ? 'Automatic watering is paused. Use "Water now" or the buttons here to water by hand.'
              : 'The farm waters on its own from the soil and the stored water.'}
          </p>
          {modeAction.error ? <p className="mt-1 text-xs text-destructive">{modeAction.error}</p> : null}
        </SectionCard>
        <SectionCard icon={<Power className="h-4 w-4" />} title="Manual pump control">
          <div className="flex gap-2">
            <Button
              className="flex-1"
              variant="outline"
              disabled={!isManual || pumpAction.pending}
              onClick={() => handlePumpToggle(true)}
            >
              Turn ON
            </Button>
            <Button
              className="flex-1"
              variant="outline"
              disabled={!isManual || pumpAction.pending}
              onClick={() => handlePumpToggle(false)}
            >
              Turn OFF
            </Button>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {isManual ? 'These buttons turn the water on or off.' : 'Switch to Manual to water by hand.'}
          </p>
          {pumpAction.error ? <p className="mt-1 text-xs text-destructive">{pumpAction.error}</p> : null}
        </SectionCard>
      </div>

      <SectionCard
        icon={<Sprout className="h-4 w-4" />}
        title="Fields"
        description="Each field is set up on its own. Watering advice uses crop, soil, growth stage, weather, and the main tank."
        action={
          <Button size="sm" variant="outline" disabled title="Zone management is not yet implemented">
            <Plus className="h-4 w-4" /> Add zone
          </Button>
        }
      >
        <div className="grid gap-5 sm:grid-cols-2">
          {zones?.map((zone) => (
            <ZoneCard
              key={zone.id}
              zone={zone}
              advice={advice?.zones.find((item) => item.zoneId === zone.id)}
              pending={zoneActions[zone.id]?.pending ?? false}
              actionError={zoneActions[zone.id]?.error}
              onToggle={handleZoneToggle}
            />
          )) ?? Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}
        </div>
      </SectionCard>
    </div>
  )
}
