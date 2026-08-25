import type { ReactNode } from 'react'
import { ArrowDown, ArrowUp, Database, Droplets, Gauge, Plus } from '@/lib/icons'
import type { DataTag, WaterSource } from '@aquaflow/shared'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { EstimateBadge } from '@/components/shared/EstimateBadge'
import { SectionCard } from '@/components/shared/SectionCard'
import { TankLevelIllustration } from '@/components/visual/FarmIllustrations'
import { VisualGlance } from '@/components/visual/VisualGlance'
import { usePolling } from '@/hooks/usePolling'
import { api } from '@/lib/api'
import { formatLiters, formatPercent, formatRate } from '@/lib/format'
import { deriveTankVisualState, tankVisualDetail, tankVisualHeadline } from '@/lib/visualState'

function FlowStep({
  icon,
  label,
  hint,
  value,
  tag,
}: {
  icon: ReactNode
  label: string
  hint: string
  value?: string
  tag?: DataTag
}) {
  return (
    <div className="flex flex-1 items-center gap-3 rounded-lg border border-border bg-card p-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-primary">{icon}</span>
      <div>
        <div className="flex items-center gap-1.5">
          {value !== undefined ? (
            <span className="text-lg font-semibold text-foreground">{value}</span>
          ) : (
            <Skeleton className="h-5 w-20" />
          )}
          {tag ? <EstimateBadge tag={tag} /> : null}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{label}</p>
        <p className="text-[11px] text-muted-foreground/70">{hint}</p>
      </div>
    </div>
  )
}

function MonitoringRow({ icon, label, value }: { icon: ReactNode; label: string; value?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-primary">{icon}</span>
      <div>
        <p className="text-muted-foreground">{label}</p>
        {value !== undefined ? (
          <p className="font-medium text-foreground">{value}</p>
        ) : (
          <Skeleton className="mt-1 h-4 w-16" />
        )}
      </div>
    </div>
  )
}

function SourceRow({ source }: { source: WaterSource }) {
  const pct = Math.round((source.state.currentL.value / source.capacityL) * 100)
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-2 font-medium text-foreground">
          <Droplets className="h-4 w-4 text-primary" />
          {source.name}
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          {formatLiters(source.state.currentL.value)} / {formatLiters(source.capacityL)} · {pct}%
          <EstimateBadge tag={source.state.currentL.tag} />
        </span>
      </div>
      <Progress value={pct} />
      <p className="text-[11px] text-muted-foreground/70">
        {source.state.active ? 'Auto-transfers into the main tank' : 'Not currently auto-transferring'}
      </p>
    </div>
  )
}

/**
 * V1's Water tab, now wired to Phase 1's simulated data layer. Water In and
 * Water Used are always shown with an "estimated" tag (there is no flow
 * sensor); Stored/tank fill is "simulated" today and becomes "measured"
 * only once a real tank sensor exists.
 */
export function WaterPage() {
  const { data: water } = usePolling(api.getWater)
  const { data: sources } = usePolling(api.getSources)

  const fillPct = water ? (water.mainTankL.value / water.tank.capacityL) * 100 : undefined
  const tankVisual =
    fillPct !== undefined && water
      ? deriveTankVisualState(fillPct, water.tank.lowThresholdPct, water.tank.criticalThresholdPct)
      : undefined

  return (
    <div className="flex flex-col gap-5">
      <SectionCard
        icon={<Droplets className="h-4 w-4" />}
        title="Water flow — in → stored → used"
        description="Water in and water used are always estimated; no flow sensor is installed."
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <FlowStep
            icon={<ArrowDown className="h-4 w-4" />}
            label="Water in"
            hint="entering storage"
            value={water ? formatRate(water.waterInLPerMin.value) : undefined}
            tag={water?.waterInLPerMin.tag}
          />
          <FlowStep
            icon={<Database className="h-4 w-4" />}
            label="Stored"
            hint="in the storage tank"
            value={water ? formatLiters(water.mainTankL.value) : undefined}
            tag={water?.mainTankL.tag}
          />
          <FlowStep
            icon={<ArrowUp className="h-4 w-4" />}
            label="Water used"
            hint="through watering"
            value={water ? formatRate(water.waterUsedLPerMin.value) : undefined}
            tag={water?.waterUsedLPerMin.tag}
          />
        </div>
      </SectionCard>

      <div className="grid gap-5 sm:grid-cols-2">
        <SectionCard icon={<Gauge className="h-4 w-4" />} title="Supply monitoring">
          {tankVisual ? (
            <div className="mb-4">
              <VisualGlance
                illustration={<TankLevelIllustration state={tankVisual} fillPct={fillPct} />}
                headline={tankVisualHeadline(tankVisual)}
                detail={tankVisualDetail(tankVisual)}
              />
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-5">
            <MonitoringRow
              icon={<Gauge className="h-4 w-4" />}
              label="How much the tank holds"
              value={water ? formatLiters(water.tank.capacityL) : undefined}
            />
            <MonitoringRow
              icon={<Database className="h-4 w-4" />}
              label="Water level"
              value={fillPct !== undefined ? formatPercent(fillPct) : undefined}
            />
            <MonitoringRow
              icon={<ArrowDown className="h-4 w-4" />}
              label="Inflow this session"
              value={water ? formatLiters(water.inflowSinceStartL.value) : undefined}
            />
            <MonitoringRow
              icon={<ArrowUp className="h-4 w-4" />}
              label="Used this session"
              value={water ? formatLiters(water.usedSinceStartL.value) : undefined}
            />
            <MonitoringRow icon={<Database className="h-4 w-4" />} label="Water used today" />
            <MonitoringRow icon={<Gauge className="h-4 w-4" />} label="Last 7 days" />
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground/70">
            Water used today and the last 7 days are not filled on this card yet. Totals for this
            session reset whenever the server restarts.
          </p>
        </SectionCard>
        <SectionCard
          icon={<Droplets className="h-4 w-4" />}
          title="Water sources"
          action={
            <Button size="sm" variant="outline" disabled>
              <Plus className="h-4 w-4" /> Add
            </Button>
          }
        >
          <div className="flex flex-col gap-5">
            {sources?.map((source) => <SourceRow key={source.id} source={source} />) ??
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
