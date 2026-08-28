import { useState } from 'react'
import type { TankConfig } from '@aquaflow/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MoreDetails, SettingHint } from '@/components/settings/MoreDetails'
import { api } from '@/lib/api'

interface TankConfigFormProps {
  tank: TankConfig
  disabled?: boolean
  onSaved: () => Promise<void>
}

/**
 * Existing main-tank fields, now writable. Does not poll — typing would
 * otherwise be overwritten every few seconds.
 */
export function TankConfigForm({ tank, disabled, onSaved }: TankConfigFormProps) {
  const [capacityL, setCapacityL] = useState(String(tank.capacityL))
  const [lowThresholdPct, setLowThresholdPct] = useState(String(tank.lowThresholdPct))
  const [criticalThresholdPct, setCriticalThresholdPct] = useState(String(tank.criticalThresholdPct))
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string>()
  const [ok, setOk] = useState<boolean>()

  async function save() {
    setPending(true)
    setMessage(undefined)
    try {
      const result = await api.saveTank({
        capacityL: Number(capacityL),
        lowThresholdPct: Number(lowThresholdPct),
        criticalThresholdPct: Number(criticalThresholdPct),
      })
      setOk(result.ok)
      setMessage(result.reason)
      if (result.ok) await onSaved()
    } catch {
      setOk(false)
      setMessage("Couldn't save. Check that AquaFlow is running.")
    } finally {
      setPending(false)
    }
  }

  async function restore() {
    setPending(true)
    setMessage(undefined)
    try {
      const result = await api.restoreTankDefaults()
      setOk(result.ok)
      setMessage(result.reason)
      if (result.ok) await onSaved()
    } catch {
      setOk(false)
      setMessage("Couldn't restore. Check that AquaFlow is running.")
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="tank-capacity">How much water can your tank hold?</Label>
          <Input
            id="tank-capacity"
            type="number"
            min={1}
            step={1}
            value={capacityL}
            disabled={disabled || pending}
            onChange={(e) => setCapacityL(e.target.value)}
          />
          <SettingHint>This is the most water your main storage tank can hold, in litres.</SettingHint>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="low-threshold">When should AquaFlow warn you the tank is getting low?</Label>
          <Input
            id="low-threshold"
            type="number"
            min={0}
            max={99}
            step={1}
            value={lowThresholdPct}
            disabled={disabled || pending}
            onChange={(e) => setLowThresholdPct(e.target.value)}
          />
          <SettingHint>Warn when the tank is only this percent full.</SettingHint>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="critical-threshold">When should watering stop to protect the pump?</Label>
          <Input
            id="critical-threshold"
            type="number"
            min={0}
            max={99}
            step={1}
            value={criticalThresholdPct}
            disabled={disabled || pending}
            onChange={(e) => setCriticalThresholdPct(e.target.value)}
          />
          <SettingHint>Stop new watering when the tank is this empty, so the pump is not run dry.</SettingHint>
        </div>
      </div>
      <MoreDetails>
        <p className="text-xs text-muted-foreground">
          The warning and stop numbers are a percent of a full tank. A common setup is 15,000 litres,
          warn at 25% full, and stop at 15% full.
        </p>
      </MoreDetails>
      <div className="mt-4 flex gap-2">
        <Button disabled={disabled || pending} onClick={() => void save()}>
          {pending ? 'Saving…' : 'Save tank'}
        </Button>
        <Button variant="outline" disabled={disabled || pending} onClick={() => void restore()}>
          Back to usual tank
        </Button>
      </div>
      {message ? (
        <p className={`mt-2 text-sm ${ok ? 'text-muted-foreground' : 'text-destructive'}`}>{message}</p>
      ) : null}
    </>
  )
}
