import type { ReactNode } from 'react'
import { ArrowDown, ArrowUp, Database, Droplets, Gauge, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { SectionCard } from '@/components/shared/SectionCard'

function FlowStep({ icon, label, hint }: { icon: ReactNode; label: string; hint: string }) {
  return (
    <div className="flex flex-1 items-center gap-3 rounded-lg bg-muted/60 p-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-card text-primary">{icon}</span>
      <div>
        <Skeleton className="h-5 w-20" />
        <p className="mt-1 text-xs text-muted-foreground">{label}</p>
        <p className="text-[11px] text-muted-foreground/70">{hint}</p>
      </div>
    </div>
  )
}

function MonitoringRow({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-primary">{icon}</span>
      <div>
        <p className="text-muted-foreground">{label}</p>
        <Skeleton className="mt-1 h-4 w-16" />
      </div>
    </div>
  )
}

function SourceRow({ name, icon }: { name: string; icon: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-2 font-medium text-foreground">
          <span className="text-primary">{icon}</span>
          {name}
        </span>
        <Skeleton className="h-4 w-24" />
      </div>
      <Progress value={0} />
    </div>
  )
}

/**
 * V1's Water tab: the "Water Flow — IN → STORED → USED" diagram, then
 * Supply Monitoring and Water Sources. Every in/used figure must be
 * labeled (estimated) once real data lands in Phase 2 — never presented
 * as measured flow (no flow sensor exists).
 */
export function WaterPage() {
  return (
    <div className="flex flex-col gap-4">
      <SectionCard
        icon={<Droplets className="h-4 w-4" />}
        title="Water flow — in → stored → used"
        description="Water in and water used are always estimated; no flow sensor is installed."
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <FlowStep icon={<ArrowDown className="h-4 w-4" />} label="Water in" hint="entering storage · estimated" />
          <FlowStep icon={<Database className="h-4 w-4" />} label="Stored" hint="main tank · simulated" />
          <FlowStep icon={<ArrowUp className="h-4 w-4" />} label="Water used" hint="through irrigation · estimated" />
        </div>
      </SectionCard>

      <div className="grid gap-4 sm:grid-cols-2">
        <SectionCard icon={<Gauge className="h-4 w-4" />} title="Supply monitoring">
          <div className="grid grid-cols-2 gap-4">
            <MonitoringRow icon={<Gauge className="h-4 w-4" />} label="Tank capacity" />
            <MonitoringRow icon={<Database className="h-4 w-4" />} label="Tank fill" />
            <MonitoringRow icon={<ArrowDown className="h-4 w-4" />} label="Inflow today" />
            <MonitoringRow icon={<ArrowUp className="h-4 w-4" />} label="Used today" />
            <MonitoringRow icon={<Database className="h-4 w-4" />} label="Daily consumption" />
            <MonitoringRow icon={<Gauge className="h-4 w-4" />} label="7-day average" />
          </div>
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
          <div className="flex flex-col gap-4">
            <SourceRow name="Rainwater Harvesting" icon={<Droplets className="h-4 w-4" />} />
            <SourceRow name="Well / Borehole" icon={<Droplets className="h-4 w-4" />} />
            <SourceRow name="Reservoir / Pond" icon={<Droplets className="h-4 w-4" />} />
            <SourceRow name="Manual Supply" icon={<Droplets className="h-4 w-4" />} />
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
