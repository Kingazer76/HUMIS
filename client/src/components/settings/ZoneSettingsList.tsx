import { useState } from 'react'
import type { CropProfile, IrrigationPreference, IrrigationZone, SoilMoistureSensorMode } from '@aquaflow/shared'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { formatIrrigationPreference } from '@/lib/format'
import { cn } from '@/lib/utils'

const selectClass = cn(
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none',
  'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
  'disabled:cursor-not-allowed disabled:opacity-50',
)

interface ZoneSettingsListProps {
  zones: IrrigationZone[]
  crops: CropProfile[]
  disabled?: boolean
  onSaved: () => Promise<void>
}

export function ZoneSettingsList({ zones, crops, disabled, onSaved }: ZoneSettingsListProps) {
  const [editing, setEditing] = useState<IrrigationZone | null>(null)
  const [name, setName] = useState('')
  const [cropId, setCropId] = useState('')
  const [preference, setPreference] = useState<IrrigationPreference>('standard')
  const [overrideMin, setOverrideMin] = useState('')
  const [overrideMax, setOverrideMax] = useState('')
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string>()
  const [ok, setOk] = useState<boolean>()

  function openEdit(zone: IrrigationZone) {
    setEditing(zone)
    setName(zone.name)
    setCropId(zone.cropId)
    setPreference(zone.irrigationPreference)
    setOverrideMin(zone.overrideMinPct !== undefined ? String(zone.overrideMinPct) : '')
    setOverrideMax(zone.overrideMaxPct !== undefined ? String(zone.overrideMaxPct) : '')
    setMessage(undefined)
  }

  async function saveZone() {
    if (!editing) return
    setPending(true)
    setMessage(undefined)
    const minRaw = overrideMin.trim()
    const maxRaw = overrideMax.trim()
    const sensorMode: SoilMoistureSensorMode = minRaw || maxRaw ? 'custom' : 'default'
    try {
      const result = await api.saveZone(editing.id, {
        name,
        cropId,
        irrigationPreference: preference,
        sensorMode,
        overrideMinPct: minRaw === '' ? null : Number(minRaw),
        overrideMaxPct: maxRaw === '' ? null : Number(maxRaw),
      })
      setOk(result.ok)
      setMessage(result.reason)
      if (result.ok) {
        setEditing(null)
        await onSaved()
      }
    } catch {
      setOk(false)
      setMessage('Could not save. Check that the AquaFlow server is running.')
    } finally {
      setPending(false)
    }
  }

  async function resetZone(zoneId: string) {
    setPending(true)
    setMessage(undefined)
    try {
      const result = await api.resetZone(zoneId)
      setOk(result.ok)
      setMessage(result.reason)
      if (result.ok) await onSaved()
    } catch {
      setOk(false)
      setMessage('Could not reset. Check that the AquaFlow server is running.')
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <div className="flex flex-col divide-y divide-border">
        {zones.map((zone) => (
          <div key={zone.id} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <span className="text-sm font-medium text-foreground">{zone.name}</span>
              <p className="text-xs text-muted-foreground">
                {zone.crop.name} · {formatIrrigationPreference(zone.irrigationPreference)}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={disabled || pending} onClick={() => openEdit(zone)}>
                Edit
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={disabled || pending}
                onClick={() => void resetZone(zone.id)}
              >
                Reset
              </Button>
            </div>
          </div>
        ))}
      </div>
      {message ? (
        <p className={`mt-2 text-sm ${ok ? 'text-muted-foreground' : 'text-destructive'}`}>{message}</p>
      ) : null}

      <Dialog open={editing !== null} onOpenChange={(open) => { if (!open && !pending) setEditing(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit this field</DialogTitle>
            <DialogDescription>
              Change the name, crop, and how generously this field is watered. Leave the soil numbers blank to use the crop's usual targets.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="zone-name">Field name</Label>
              <Input id="zone-name" value={name} disabled={pending} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="zone-crop">Crop</Label>
              <select
                id="zone-crop"
                className={selectClass}
                value={cropId}
                disabled={pending}
                onChange={(e) => setCropId(e.target.value)}
              >
                {crops.map((crop) => (
                  <option key={crop.id} value={crop.id}>
                    {crop.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="zone-preference">Watering style</Label>
              <select
                id="zone-preference"
                className={selectClass}
                value={preference}
                disabled={pending}
                onChange={(e) => setPreference(e.target.value as IrrigationPreference)}
              >
                <option value="standard">Usual watering</option>
                <option value="water-saving">Save water (starts a little later, stops a little sooner)</option>
                <option value="aggressive">Extra watering (starts sooner, runs a little longer)</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="zone-min">Dry-soil target (%) </Label>
                <Input
                  id="zone-min"
                  type="number"
                  min={0}
                  max={100}
                  placeholder="crop usual"
                  value={overrideMin}
                  disabled={pending}
                  onChange={(e) => setOverrideMin(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="zone-max">Wet-enough target (%)</Label>
                <Input
                  id="zone-max"
                  type="number"
                  min={0}
                  max={100}
                  placeholder="crop usual"
                  value={overrideMax}
                  disabled={pending}
                  onChange={(e) => setOverrideMax(e.target.value)}
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground/70">
              The dry number must be below the wet-enough number. AquaFlow starts watering at the dry number and stops at the wet-enough number.
            </p>
            {editing && message ? (
              <p className={`text-sm ${ok ? 'text-muted-foreground' : 'text-destructive'}`}>{message}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={pending} onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button disabled={pending} onClick={() => void saveZone()}>
              {pending ? 'Saving…' : 'Save field'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
