import { Settings2, Sprout } from '@/lib/icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SectionCard } from '@/components/shared/SectionCard'

/**
 * V1's Settings tab: main-tank capacity/thresholds (defaults 15,000 L /
 * 25% / 15%, matching the spec's prototype figures) and per-zone config.
 * Wired to the settings API in Phase 4.
 */
export function SettingsPage() {
  return (
    <div className="flex flex-col gap-4">
      <SectionCard
        icon={<Settings2 className="h-4 w-4" />}
        title="Main tank configuration"
        description="Capacity is authoritative for tank %, available water, days remaining, shortage prediction, and conservation mode. Defaults: 15,000 L / 25% / 15%."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="tank-capacity">Tank capacity (L)</Label>
            <Input id="tank-capacity" placeholder="15000" disabled />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="low-threshold">Low-water threshold (%)</Label>
            <Input id="low-threshold" placeholder="25" disabled />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="critical-threshold">Critical-water threshold (%)</Label>
            <Input id="critical-threshold" placeholder="15" disabled />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button disabled>Save settings</Button>
          <Button variant="outline" disabled>
            Restore defaults
          </Button>
        </div>
      </SectionCard>

      <SectionCard icon={<Sprout className="h-4 w-4" />} title="Irrigation zone configuration">
        <div className="flex flex-col divide-y divide-border">
          {['Zone A — North Field', 'Zone B — South Field'].map((zone) => (
            <div key={zone} className="flex items-center justify-between gap-3 py-3">
              <span className="text-sm font-medium text-foreground">{zone}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled>
                  Edit
                </Button>
                <Button size="sm" variant="outline" disabled>
                  Reset
                </Button>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  )
}
