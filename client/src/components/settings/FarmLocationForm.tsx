import { useState } from 'react'
import type { FarmLocation } from '@aquaflow/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MoreDetails, SettingHint } from '@/components/settings/MoreDetails'
import { api } from '@/lib/api'

interface FarmLocationFormProps {
  location: FarmLocation
  disabled?: boolean
  onSaved: () => Promise<void>
}

/**
 * Farm coordinates used by the Open-Meteo forecast. Same save/restore
 * pattern as the tank form. Does not poll while typing.
 */
export function FarmLocationForm({ location, disabled, onSaved }: FarmLocationFormProps) {
  const [latitude, setLatitude] = useState(String(location.latitude))
  const [longitude, setLongitude] = useState(String(location.longitude))
  const [label, setLabel] = useState(location.label)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string>()
  const [ok, setOk] = useState<boolean>()

  async function save() {
    setPending(true)
    setMessage(undefined)
    try {
      const result = await api.saveLocation({
        latitude: Number(latitude),
        longitude: Number(longitude),
        label,
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
      const result = await api.restoreLocationDefaults()
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
      <div className="space-y-1.5">
        <Label htmlFor="farm-place">Where is this farm?</Label>
        <Input
          id="farm-place"
          value={label}
          disabled={disabled || pending}
          onChange={(e) => setLabel(e.target.value)}
        />
        <SettingHint>AquaFlow uses this place for the weather forecast.</SettingHint>
      </div>
      <MoreDetails>
        <p className="text-xs text-muted-foreground">
          If the weather looks wrong, you can set the exact map position. Most farmers only need the place name.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="farm-latitude">North–south map position</Label>
            <Input
              id="farm-latitude"
              type="number"
              min={-90}
              max={90}
              step="any"
              value={latitude}
              disabled={disabled || pending}
              onChange={(e) => setLatitude(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="farm-longitude">East–west map position</Label>
            <Input
              id="farm-longitude"
              type="number"
              min={-180}
              max={180}
              step="any"
              value={longitude}
              disabled={disabled || pending}
              onChange={(e) => setLongitude(e.target.value)}
            />
          </div>
        </div>
      </MoreDetails>
      <div className="mt-4 flex gap-2">
        <Button disabled={disabled || pending} onClick={() => void save()}>
          {pending ? 'Saving…' : 'Save place'}
        </Button>
        <Button variant="outline" disabled={disabled || pending} onClick={() => void restore()}>
          Back to usual place
        </Button>
      </div>
      {message ? (
        <p className={`mt-2 text-sm ${ok ? 'text-muted-foreground' : 'text-destructive'}`}>{message}</p>
      ) : null}
    </>
  )
}
