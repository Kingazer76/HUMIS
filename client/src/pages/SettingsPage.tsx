import { useCallback, useEffect, useState } from 'react'
import { CloudSun, Database, Power, Sprout } from '@/lib/icons'
import type { OperationMode, SettingsSnapshot, WaterSource } from '@aquaflow/shared'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { SectionCard } from '@/components/shared/SectionCard'
import { MoreDetails, SettingHint } from '@/components/settings/MoreDetails'
import { TankConfigForm } from '@/components/settings/TankConfigForm'
import { FarmLocationForm } from '@/components/settings/FarmLocationForm'
import { ZoneSettingsList } from '@/components/settings/ZoneSettingsList'
import { AccountCard } from '@/components/settings/AccountCard'
import { usePolling } from '@/hooks/usePolling'
import { api } from '@/lib/api'
import { farmerSoilName, formatLiters, formatMm, formatPercent, formatTemperatureC } from '@/lib/format'

let settingsCache: SettingsSnapshot | undefined

function sourceBlurb(source: WaterSource): string {
  if (source.kind === 'rainwater') return 'Rain fills the main tank. It has no tank of its own.'
  if (source.state.active) return 'Can send water into the main tank.'
  return 'Not sending water into the main tank right now.'
}

/**
 * Settings tab: farmer-facing setup language over the same saved tank,
 * place, and field values. Saving still writes the live farm settings.
 */
export function SettingsPage() {
  const [data, setData] = useState<SettingsSnapshot | undefined>(settingsCache)
  const [error, setError] = useState<string>()
  const [modeAction, setModeAction] = useState<{ pending: boolean; error?: string }>({ pending: false })

  const waterPolling = usePolling(api.getWater)
  const sourcesPolling = usePolling(api.getSources)
  const systemPolling = usePolling(api.getSystem)
  const planningPolling = usePolling(api.getPlanning)
  const zonesPolling = usePolling(api.getZones)
  const { data: water } = waterPolling
  const { data: sources } = sourcesPolling
  const { data: system } = systemPolling
  const { data: planning } = planningPolling
  const { data: liveZones } = zonesPolling

  const load = useCallback(async () => {
    try {
      const snapshot = await api.getSettings()
      settingsCache = snapshot
      setData(snapshot)
      setError(undefined)
    } catch {
      setError("Can't load settings right now. Check that AquaFlow is running.")
    }
  }, [])

  useEffect(() => {
    if (settingsCache) return
    void load()
  }, [load])

  async function handleModeChange(mode: OperationMode) {
    if (system?.system.operationMode === mode) return
    setModeAction({ pending: true })
    try {
      const result = await api.setOperationMode(mode)
      setModeAction({ pending: false, error: result.ok ? undefined : result.reason })
      await systemPolling.refetch()
    } catch {
      setModeAction({ pending: false, error: "Couldn't change watering. Please try again." })
    }
  }

  const loading = data === undefined && error === undefined
  const isManual = system?.system.operationMode === 'manual'
  const weather = planning?.weather
  const rainOnFarm = system?.rain.isRaining.value
  const conditionZones = liveZones ?? data?.zones

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted-foreground">
        Tell AquaFlow about your farm in everyday words. You do not need special water words.
      </p>

      <AccountCard />

      <SectionCard
        icon={<Sprout className="h-4 w-4" />}
        title="Your farm"
        description="What you grow, the soil it sits in, and how the crop is growing."
      >
        {data ? (
          <>
            <ZoneSettingsList zones={data.zones} crops={data.crops} soils={data.soils} onSaved={load} />
            <div className="mt-4 border-t border-border pt-4">
              <FarmLocationForm
                key={`${data.location.latitude}-${data.location.longitude}-${data.location.label}`}
                location={data.location}
                onSaved={load}
              />
            </div>
          </>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {['Zone A — North Field', 'Zone B — South Field'].map((zone) => (
              <div key={zone} className="flex items-center justify-between gap-3 py-3">
                <span className="text-sm font-medium text-foreground">{zone}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled>
                    Change
                  </Button>
                  <Button size="sm" variant="outline" disabled>
                    Back to usual
                  </Button>
                </div>
              </div>
            ))}
            <p className="pt-3 text-sm text-muted-foreground">
              {loading ? 'Loading your fields…' : error}
            </p>
          </div>
        )}
      </SectionCard>

      <SectionCard
        icon={<Database className="h-4 w-4" />}
        title="Your water"
        description="Where water comes from, how big the main tank is, and how much is in it now."
      >
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-foreground">Where does your water come from?</p>
            <SettingHint>Fields drink only from the main tank. Other sources can fill that tank.</SettingHint>
            {sources ? (
              <ul className="mt-2 flex flex-col gap-2">
                {sources.map((source) => (
                  <li key={source.id} className="text-sm">
                    <span className="font-medium text-foreground">{source.name}</span>
                    <span className="text-muted-foreground"> — {sourceBlurb(source)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Loading water sources…</p>
            )}
          </div>

          <div>
            <p className="text-sm font-medium text-foreground">How much water is in the tank?</p>
            <p className="text-lg font-semibold text-foreground">
              {water ? formatLiters(water.mainTankL.value) : '…'}
            </p>
            <SettingHint>This is the water your fields can use right now.</SettingHint>
          </div>

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
                  <Label htmlFor="tank-capacity">How much water can your tank hold?</Label>
                  <Input id="tank-capacity" placeholder="15000" disabled />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="low-threshold">When should AquaFlow warn you the tank is getting low?</Label>
                  <Input id="low-threshold" placeholder="25" disabled />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="critical-threshold">When should watering stop to protect the pump?</Label>
                  <Input id="critical-threshold" placeholder="15" disabled />
                </div>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {loading ? 'Loading your tank numbers…' : error}
              </p>
            </>
          )}

          <MoreDetails>
            <p className="text-xs text-muted-foreground">
              AquaFlow waters through the existing pump and field valves. It does not ask drip vs sprinkler.
              Change how soon a field is watered under Your farm.
            </p>
          </MoreDetails>
        </div>
      </SectionCard>

      <SectionCard
        icon={<CloudSun className="h-4 w-4" />}
        title="Your farm conditions"
        description="What the soil, weather, and stored water look like right now."
      >
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-sm font-medium text-foreground">How wet is the soil?</p>
            <SettingHint>Change crop and soil under Your farm if a field looks wrong.</SettingHint>
            {conditionZones ? (
              <ul className="mt-2 flex flex-col gap-1.5">
                {conditionZones.map((zone) => (
                  <li key={zone.id} className="text-sm text-foreground">
                    {zone.name}: about {formatPercent(zone.state.soilMoisturePct.value)} wet
                    {' · '}
                    {zone.crop.name} on {farmerSoilName(zone.soilId)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Loading soil wetness…</p>
            )}
          </div>

          <div>
            <p className="text-sm font-medium text-foreground">Weather</p>
            {weather?.available && weather.condition ? (
              <>
                <p className="text-sm text-foreground">
                  {weather.condition === 'rain'
                    ? 'Rain is in the forecast.'
                    : weather.condition === 'hot-dry'
                      ? 'Hot, dry weather is in the forecast.'
                      : 'No rain is in the forecast right now.'}
                  {weather.temperatureC ? ` About ${formatTemperatureC(weather.temperatureC.value)}.` : ''}
                  {weather.expectedRainfallMm && weather.expectedRainfallMm.value > 0
                    ? ` Expected rain about ${formatMm(weather.expectedRainfallMm.value)}.`
                    : ''}
                </p>
                <SettingHint>
                  {weather.location?.label ? `Forecast for ${weather.location.label}.` : 'Forecast for this farm.'}
                </SettingHint>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Can't load the weather right now. AquaFlow can still water using the soil and the tank.
              </p>
            )}
          </div>

          <div>
            <p className="text-sm font-medium text-foreground">Rain and water on the farm</p>
            <p className="text-sm text-foreground">
              {rainOnFarm === undefined
                ? 'Checking for rain…'
                : rainOnFarm
                  ? 'It is raining on the farm. Rain is added to the main tank.'
                  : 'It is not raining on the farm right now.'}
            </p>
            <p className="mt-1 text-sm text-foreground">
              Stored water: {water ? formatLiters(water.totalAvailableL.value) : '…'} in the main tank.
            </p>
            <SettingHint>If the tank runs low, AquaFlow will not start new watering.</SettingHint>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        icon={<Power className="h-4 w-4" />}
        title="Automatic watering"
        description="Let AquaFlow decide when your crops need water."
      >
        <div className="flex gap-2">
          <Button
            className="flex-1"
            disabled={modeAction.pending || !system}
            variant={system?.system.operationMode === 'auto' ? 'default' : 'outline'}
            onClick={() => void handleModeChange('auto')}
          >
            Auto
          </Button>
          <Button
            className="flex-1"
            disabled={modeAction.pending || !system}
            variant={system?.system.operationMode === 'manual' ? 'default' : 'outline'}
            onClick={() => void handleModeChange('manual')}
          >
            Manual
          </Button>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {system
            ? isManual
              ? 'You decide. AquaFlow will not water on its own. Use Water now on the Irrigation tab.'
              : 'AquaFlow decides. It starts and stops watering using your crop, soil, weather, and tank water.'
            : 'Loading watering mode…'}
        </p>
        {modeAction.error ? <p className="mt-1 text-xs text-destructive">{modeAction.error}</p> : null}
        <MoreDetails>
          <p className="text-xs text-muted-foreground">
            Auto and Manual here are the same buttons as on the Irrigation tab. How generously each field is watered is set under Your farm.
          </p>
        </MoreDetails>
      </SectionCard>
    </div>
  )
}
