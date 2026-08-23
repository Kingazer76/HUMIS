import { Activity, CloudRain, Database, Plus, Power, Settings2, Sprout } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { MetricCard } from '@/components/shared/MetricCard'
import { SectionCard } from '@/components/shared/SectionCard'

function ZoneCardPlaceholder({ name }: { name: string }) {
  return (
    <Card className="gap-3">
      <CardHeader className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Sprout className="h-4 w-4 text-primary" />
          {name}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Skeleton className="h-4 w-40" />
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Soil moisture</span>
          <Skeleton className="h-4 w-10" />
        </div>
        <Progress value={0} />
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" variant="outline" disabled>
            Edit
          </Button>
          <Button size="sm" disabled>
            Water now
          </Button>
          <Button size="sm" variant="outline" disabled>
            Reset
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * V1's Irrigation tab: sensor readouts, pump/system status, the
 * Auto/Manual + manual pump controls, then per-zone cards. Phase 3 wires
 * this to the safety-controller-backed irrigation engine and hysteresis.
 */
export function IrrigationPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard icon={<Sprout className="h-4 w-4" />} label="Soil moisture" />
        <MetricCard icon={<Database className="h-4 w-4" />} label="Tank level" />
        <MetricCard icon={<CloudRain className="h-4 w-4" />} label="Rain status" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SectionCard icon={<Power className="h-4 w-4" />} title="Pump status" />
        <SectionCard icon={<Activity className="h-4 w-4" />} title="System status" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SectionCard icon={<Settings2 className="h-4 w-4" />} title="Operation mode">
          <div className="flex gap-2">
            <Button className="flex-1" disabled>
              Auto
            </Button>
            <Button className="flex-1" variant="outline" disabled>
              Manual
            </Button>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            System controls the pump automatically based on sensor readings.
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
          <p className="mt-2 text-sm text-muted-foreground">Switch to Manual mode to control the pump.</p>
        </SectionCard>
      </div>

      <SectionCard
        icon={<Sprout className="h-4 w-4" />}
        title="Crop irrigation zones"
        description="Each zone is configured independently."
        action={
          <Button size="sm" variant="outline" disabled>
            <Plus className="h-4 w-4" /> Add zone
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <ZoneCardPlaceholder name="Zone A — North Field" />
          <ZoneCardPlaceholder name="Zone B — South Field" />
        </div>
      </SectionCard>
    </div>
  )
}
