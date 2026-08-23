import { Activity, CloudRain, Database, Plus, Power, Settings2, Sprout } from '@/lib/icons'
import type { IrrigationZone } from '@aquaflow/shared'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { EstimateBadge } from '@/components/shared/EstimateBadge'
import { MetricCard } from '@/components/shared/MetricCard'
import { SectionCard } from '@/components/shared/SectionCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { usePolling } from '@/hooks/usePolling'
import { api } from '@/lib/api'
import { formatPercent } from '@/lib/format'

function ZoneCard({ zone }: { zone: IrrigationZone }) {
  const minPct = zone.overrideMinPct ?? zone.crop.defaultMinMoisturePct
  const maxPct = zone.overrideMaxPct ?? zone.crop.defaultMaxMoisturePct
  const moisture = zone.state.soilMoisturePct.value
  const inRange = moisture >= minPct && moisture <= maxPct

  return (
    <Card className="gap-3">
      <CardHeader className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Sprout className="h-4 w-4 text-primary" />
            {zone.name}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {zone.crop.name} · priority {zone.crop.priority}
          </p>
        </div>
        <StatusBadge tone={zone.state.active ? 'info' : inRange ? 'good' : 'warning'}>
          {zone.state.active ? 'Irrigating' : inRange ? 'OK' : 'Needs water'}
        </StatusBadge>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            Soil moisture
            <EstimateBadge tag={zone.state.soilMoisturePct.tag} />
          </span>
          <span className="font-medium text-foreground">{formatPercent(moisture)}</span>
        </div>
        <Progress value={moisture} />
        <div className="flex justify-between text-[11px] text-muted-foreground/70">
          <span>0%</span>
          <span>
            target {minPct}-{maxPct}%
          </span>
          <span>100%</span>
        </div>
        <p className="text-[11px] text-muted-foreground/70">
          {zone.sensorMode === 'default' ? 'Default sensor' : 'Custom sensor'}
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" variant="outline" disabled title="Zone editing arrives in Phase 3">
            Edit
          </Button>
          <Button size="sm" disabled title="Irrigation actions arrive in Phase 3">
            {zone.state.active ? 'Stop' : 'Water now'}
          </Button>
          <Button size="sm" variant="outline" disabled title="Zone editing arrives in Phase 3">
            Reset
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * V1's Irrigation tab. Phase 1 wires every read-only sensor/status display
 * to the simulated device layer. Controls (Water now/Stop, manual pump,
 * Auto/Manual, zone edit) stay disabled on purpose — no irrigation
 * decision or actuation exists until Phase 3's safety controller does.
 */
export function IrrigationPage() {
  const { data: zones } = usePolling(api.getZones)
  const { data: water } = usePolling(api.getWater)
  const { data: system } = usePolling(api.getSystem)

  const avgMoisture =
    zones && zones.length > 0
      ? zones.reduce((sum, z) => sum + z.state.soilMoisturePct.value, 0) / zones.length
      : undefined
  const tankFillPct = water ? (water.mainTankL.value / water.tank.capacityL) * 100 : undefined

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          icon={<Sprout className="h-4 w-4" />}
          label="Soil moisture"
          badge={zones ? <StatusBadge tone="good">Normal</StatusBadge> : undefined}
          value={avgMoisture !== undefined ? formatPercent(avgMoisture) : undefined}
          hint={
            zones ? (
              <span className="flex items-center gap-1.5">
                Average across zones <EstimateBadge tag={zones[0]?.state.soilMoisturePct.tag ?? 'simulated'} />
              </span>
            ) : undefined
          }
        />
        <MetricCard
          icon={<Database className="h-4 w-4" />}
          label="Tank level"
          value={tankFillPct !== undefined ? formatPercent(tankFillPct) : undefined}
          hint={water ? <EstimateBadge tag={water.mainTankL.tag} /> : undefined}
        />
        <MetricCard
          icon={<CloudRain className="h-4 w-4" />}
          label="Rain status"
          badge={
            system ? (
              <StatusBadge tone={system.rain.isRaining.value ? 'info' : 'neutral'}>
                {system.rain.isRaining.value ? 'Rain' : 'Clear'}
              </StatusBadge>
            ) : undefined
          }
          value={system ? (system.rain.isRaining.value ? 'Rain detected' : 'No rain') : undefined}
          hint={system ? <EstimateBadge tag={system.rain.isRaining.tag} /> : undefined}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SectionCard icon={<Power className="h-4 w-4" />} title="Pump status">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-primary">
              <Power className="h-4 w-4" />
            </span>
            <div>
              <div className="font-medium text-foreground">
                {system ? (system.pump.isOn.value ? 'Pump running' : 'Pump idle') : <Skeleton className="h-4 w-24" />}
              </div>
              <p className="text-xs text-muted-foreground">
                {system ? (system.pump.isOn.value ? 'Water flowing' : 'No water flowing') : null}
              </p>
            </div>
          </div>
        </SectionCard>
        <SectionCard icon={<Activity className="h-4 w-4" />} title="System status">
          <StatusBadge tone={system?.system.phase === 'irrigating' ? 'info' : 'neutral'}>
            {system ? system.system.phase.replace('-', ' ') : '—'}
          </StatusBadge>
        </SectionCard>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SectionCard icon={<Settings2 className="h-4 w-4" />} title="Operation mode">
          <div className="flex gap-2">
            <Button className="flex-1" disabled variant={system?.system.operationMode === 'auto' ? 'default' : 'outline'}>
              Auto
            </Button>
            <Button className="flex-1" variant={system?.system.operationMode === 'manual' ? 'default' : 'outline'} disabled>
              Manual
            </Button>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            System controls the pump automatically based on sensor readings. Switching modes arrives in
            Phase 3.
          </p>
        </SectionCard>
        <SectionCard icon={<Power className="h-4 w-4" />} title="Manual pump control">
          <div className="flex gap-2">
            <Button className="flex-1" variant="outline" disabled>
              Turn ON
            </Button>
            <Button className="flex-1" variant="outline" disabled>
              Turn OFF
            </Button>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Manual pump control arrives in Phase 3.</p>
        </SectionCard>
      </div>

      <SectionCard
        icon={<Sprout className="h-4 w-4" />}
        title="Crop irrigation zones"
        description="Each zone is configured independently."
        action={
          <Button size="sm" variant="outline" disabled title="Zone management arrives in Phase 3">
            <Plus className="h-4 w-4" /> Add zone
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {zones?.map((zone) => <ZoneCard key={zone.id} zone={zone} />) ??
            Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}
        </div>
      </SectionCard>
    </div>
  )
}
