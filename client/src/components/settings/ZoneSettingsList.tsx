import { useState } from 'react'
import type { CropProfile, IrrigationPreference, IrrigationZone, SoilId, SoilMoistureSensorMode, SoilType } from '@aquaflow/shared'
import { getSoil, SOIL_CATALOG } from '@aquaflow/shared'
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
  soils?: SoilType[]
  disabled?: boolean
  onSaved: () => Promise<void>
}

function stageLabel(zone: IrrigationZone): string {
  return (
    zone.crop.stages?.find((s) => s.id === zone.growthStageId)?.name ??
    zone.crop.stages?.find((s) => s.id === 'mid')?.name ??
    'Mid-season'
  )
}

function pickStageId(crop: CropProfile | undefined, preferred: string): string {
  if (crop?.stages && crop.stages.length > 0) {
    if (crop.stages.some((s) => s.id === preferred)) return preferred
    return crop.stages.find((s) => s.id === 'mid')?.id ?? crop.stages[0]!.id
  }
  return preferred || 'mid'
}

export function ZoneSettingsList({ zones, crops, soils, disabled, onSaved }: ZoneSettingsListProps) {
  const soilOptions = soils && soils.length > 0 ? soils : SOIL_CATALOG
  const [editing, setEditing] = useState<IrrigationZone | null>(null)
  const [name, setName] = useState('')
  const [cropId, setCropId] = useState('')
  const [soilId, setSoilId] = useState<SoilId>(getSoil(undefined).id)
  const [growthStageId, setGrowthStageId] = useState('mid')
  const [preference, setPreference] = useState<IrrigationPreference>('standard')
  const [overrideMin, setOverrideMin] = useState('')
  const [overrideMax, setOverrideMax] = useState('')
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string>()
  const [ok, setOk] = useState<boolean>()

  const selectedCrop = crops.find((c) => c.id === cropId)

  function openEdit(zone: IrrigationZone) {
    const crop = crops.find((c) => c.id === zone.cropId) ?? zone.crop
    setEditing(zone)
    setName(zone.name)
    setCropId(zone.cropId)
    setSoilId(getSoil(zone.soilId).id)
    setGrowthStageId(pickStageId(crop, zone.growthStageId ?? 'mid'))
    setPreference(zone.irrigationPreference)
    setOverrideMin(zone.overrideMinPct !== undefined ? String(zone.overrideMinPct) : '')
    setOverrideMax(zone.overrideMaxPct !== undefined ? String(zone.overrideMaxPct) : '')
    setMessage(undefined)
  }

  function onCropChange(nextId: string) {
    setCropId(nextId)
    const crop = crops.find((c) => c.id === nextId)
    setGrowthStageId(pickStageId(crop, growthStageId))
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
        soilId,
        growthStageId,
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
                {zone.crop.name} · {getSoil(zone.soilId).name} · {stageLabel(zone)} ·{' '}
                {formatIrrigationPreference(zone.irrigationPreference)}
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
              AquaFlow uses the crop, soil, and growth stage together to decide when to water. Leave the soil numbers blank to use that calculated range.
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
                onChange={(e) => onCropChange(e.target.value)}
              >
                {crops.map((crop) => (
                  <option key={crop.id} value={crop.id}>
                    {crop.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="zone-soil">Soil</Label>
              <select
                id="zone-soil"
                className={selectClass}
                value={soilId}
                disabled={pending}
                onChange={(e) => setSoilId(e.target.value as SoilId)}
              >
                {soilOptions.map((soil) => (
                  <option key={soil.id} value={soil.id}>
                    {soil.name}
                  </option>
                ))}
              </select>
            </div>
            {selectedCrop?.stages && selectedCrop.stages.length > 0 ? (
              <div className="space-y-1.5">
                <Label htmlFor="zone-stage">Growth stage</Label>
                <select
                  id="zone-stage"
                  className={selectClass}
                  value={growthStageId}
                  disabled={pending}
                  onChange={(e) => setGrowthStageId(e.target.value)}
                >
                  {selectedCrop.stages.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
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
              The dry number must be below the wet-enough number. AquaFlow starts watering at the dry number and stops at the wet-enough number. If you leave both blank, the start line comes from this crop, soil, and growth stage.
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
