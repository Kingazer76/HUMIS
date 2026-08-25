import { useCallback, useEffect, useState } from 'react'
import { Settings2, Sprout } from '@/lib/icons'
import type { SettingsSnapshot } from '@aquaflow/shared'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { SectionCard } from '@/components/shared/SectionCard'
import { TankConfigForm } from '@/components/settings/TankConfigForm'
import { ZoneSettingsList } from '@/components/settings/ZoneSettingsList'
import { api } from '@/lib/api'

/**
 * V1's Settings tab: main-tank capacity/thresholds and per-zone config.
 * Saving writes the live farm settings (kept in memory while the server
 * runs). Overview, Water, Planning, and Irrigation pick the new numbers
 * up on their next refresh.
 */
export function SettingsPage() {
  const [data, setData] = useState<SettingsSnapshot>()
  const [error, setError] = useState<string>()

  const load = useCallback(async () => {
    try {
      const snapshot = await api.getSettings()
      setData(snapshot)
      setError(undefined)
    } catch {
      setError("Can't load settings right now. Check that the AquaFlow server is running.")
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const loading = data === undefined && error === undefined

  return (
    <div className="flex flex-col gap-5">
      <SectionCard
        icon={<Settings2 className="h-4 w-4" />}
        title="Main tank configuration"
        description="How big the tank is, when to warn you, and when to stop watering. These numbers also change tank percentage, available water, days remaining, and shortage risk. Usual values: 15,000 L / 25% / 15%."
      >
        {data ? (
          <TankConfigForm
            key={`${data.tank.capacityL}-${data.tank.lowThresholdPct}-${data.tank.criticalThresholdPct}`}
            tank={data.tank}
            onSaved={load}
          />
        ) : (
          <>
            <div className="grid gap-5 sm:grid-cols-3">
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
            <p className="mt-2 text-sm text-muted-foreground">
              {loading ? 'Loading the current tank numbers…' : error}
            </p>
          </>
        )}
      </SectionCard>

      <SectionCard icon={<Sprout className="h-4 w-4" />} title="Irrigation zone configuration">
        {data ? (
          <ZoneSettingsList zones={data.zones} crops={data.crops} onSaved={load} />
        ) : (
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
        )}
      </SectionCard>
    </div>
  )
}
