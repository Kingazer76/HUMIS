import { useState } from 'react'
import type { TankConfig } from '@aquaflow/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
      setMessage('Could not save. Check that the AquaFlow server is running.')
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
      setMessage('Could not restore. Check that the AquaFlow server is running.')
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="tank-capacity">Tank capacity (L)</Label>
          <Input
            id="tank-capacity"
            type="number"
            min={1}
            step={1}
            value={capacityL}
            disabled={disabled || pending}
            onChange={(e) => setCapacityL(e.target.value)}
          />
          <p className="text-[11px] text-muted-foreground/70">How many litres this tank holds when it is full.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="low-threshold">Low-water threshold (%)</Label>
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
          <p className="text-[11px] text-muted-foreground/70">Warn when the tank has fallen to this percent full.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="critical-threshold">Critical-water threshold (%)</Label>
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
          <p className="text-[11px] text-muted-foreground/70">Stop watering when the tank is this empty, to protect the pump.</p>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button disabled={disabled || pending} onClick={() => void save()}>
          {pending ? 'Saving…' : 'Save settings'}
        </Button>
        <Button variant="outline" disabled={disabled || pending} onClick={() => void restore()}>
          Restore defaults
        </Button>
      </div>
      {message ? (
        <p className={`mt-2 text-sm ${ok ? 'text-muted-foreground' : 'text-destructive'}`}>{message}</p>
      ) : null}
    </>
  )
}
