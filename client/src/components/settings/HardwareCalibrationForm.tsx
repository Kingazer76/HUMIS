import { useState } from 'react'
import type { HardwareCalibration, HardwareLinkStatus } from '@aquaflow/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MoreDetails, SettingHint } from '@/components/settings/MoreDetails'
import { api } from '@/lib/api'

interface HardwareCalibrationFormProps {
  calibration: HardwareCalibration
  hardware: HardwareLinkStatus
  disabled?: boolean
  onSaved: () => Promise<void>
}

function boardStatus(hardware: HardwareLinkStatus): string {
  if (!hardware.boardHeard || hardware.lastTelemetryAgeMs === null) {
    return 'The ESP32 board has not sent a reading yet. That is OK while you are still using the practice farm.'
  }
  const seconds = Math.max(0, Math.round(hardware.lastTelemetryAgeMs / 1000))
  if (seconds < 20) return `The board sent a reading about ${seconds} second${seconds === 1 ? '' : 's'} ago.`
  return `The board last sent a reading about ${seconds} seconds ago. If that number keeps growing, the board is not reaching HUMIS.`
}

/**
 * Empty/full tank distances and soil dry/wet numbers live next to the
 * tank size in Settings — not a second settings system.
 */
export function HardwareCalibrationForm({
  calibration,
  hardware,
  disabled,
  onSaved,
}: HardwareCalibrationFormProps) {
  const [tankEmptyDistanceCm, setTankEmptyDistanceCm] = useState(String(calibration.tankEmptyDistanceCm))
  const [tankFullDistanceCm, setTankFullDistanceCm] = useState(String(calibration.tankFullDistanceCm))
  const [soilDryAdc, setSoilDryAdc] = useState(String(calibration.soilDryAdc))
  const [soilWetAdc, setSoilWetAdc] = useState(String(calibration.soilWetAdc))
  const [relayActiveHigh, setRelayActiveHigh] = useState(calibration.relayActiveHigh)
  const [maxPumpOnSeconds, setMaxPumpOnSeconds] = useState(String(calibration.maxPumpOnSeconds))
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string>()
  const [ok, setOk] = useState<boolean>()

  async function save() {
    setPending(true)
    setMessage(undefined)
    try {
      const result = await api.saveHardwareCalibration({
        tankEmptyDistanceCm: Number(tankEmptyDistanceCm),
        tankFullDistanceCm: Number(tankFullDistanceCm),
        soilDryAdc: Number(soilDryAdc),
        soilWetAdc: Number(soilWetAdc),
        relayActiveHigh,
        maxPumpOnSeconds: Number(maxPumpOnSeconds),
      })
      setOk(result.ok)
      setMessage(result.reason)
      if (result.ok) await onSaved()
    } catch {
      setOk(false)
      setMessage("Couldn't save. Check that HUMIS is running.")
    } finally {
      setPending(false)
    }
  }

  async function restore() {
    setPending(true)
    setMessage(undefined)
    try {
      const result = await api.restoreHardwareCalibrationDefaults()
      setOk(result.ok)
      setMessage(result.reason)
      if (result.ok && result.hardwareCalibration) {
        setTankEmptyDistanceCm(String(result.hardwareCalibration.tankEmptyDistanceCm))
        setTankFullDistanceCm(String(result.hardwareCalibration.tankFullDistanceCm))
        setSoilDryAdc(String(result.hardwareCalibration.soilDryAdc))
        setSoilWetAdc(String(result.hardwareCalibration.soilWetAdc))
        setRelayActiveHigh(result.hardwareCalibration.relayActiveHigh)
        setMaxPumpOnSeconds(String(result.hardwareCalibration.maxPumpOnSeconds))
        await onSaved()
      }
    } catch {
      setOk(false)
      setMessage("Couldn't restore. Check that HUMIS is running.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-foreground">{boardStatus(hardware)}</p>
      <p className="text-sm text-muted-foreground">
        {hardware.useSimulated
          ? 'The farm on this screen is still the practice farm. Watering buttons will not turn the real pump on. You can still teach HUMIS your tank and soil numbers, and the board can talk to HUMIS for testing.'
          : 'HUMIS is using the real board for tank level, Zone A soil, and the pump. Zone B still has no soil probe, so it stays on the practice soil number until you wire a second sensor.'}
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="empty-distance">When the tank is empty, how many centimetres does the water sensor read?</Label>
          <Input
            id="empty-distance"
            type="number"
            min={2}
            max={400}
            step={0.1}
            value={tankEmptyDistanceCm}
            disabled={disabled || pending}
            onChange={(e) => setTankEmptyDistanceCm(e.target.value)}
          />
          <SettingHint>This is usually the bigger number. The sensor sits above the water, so empty is farther away.</SettingHint>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="full-distance">When the tank is full, how many centimetres does the water sensor read?</Label>
          <Input
            id="full-distance"
            type="number"
            min={2}
            max={400}
            step={0.1}
            value={tankFullDistanceCm}
            disabled={disabled || pending}
            onChange={(e) => setTankFullDistanceCm(e.target.value)}
          />
          <SettingHint>This is usually the smaller number. Do not guess — measure your own tank.</SettingHint>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="soil-dry">Soil sensor number when Zone A soil is bone dry</Label>
          <Input
            id="soil-dry"
            type="number"
            min={0}
            max={4095}
            step={1}
            value={soilDryAdc}
            disabled={disabled || pending}
            onChange={(e) => setSoilDryAdc(e.target.value)}
          />
          <SettingHint>Read this from the board while the probe is in dry soil or in open air, then type it here.</SettingHint>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="soil-wet">Soil sensor number when Zone A soil is soaked</Label>
          <Input
            id="soil-wet"
            type="number"
            min={0}
            max={4095}
            step={1}
            value={soilWetAdc}
            disabled={disabled || pending}
            onChange={(e) => setSoilWetAdc(e.target.value)}
          />
          <SettingHint>Read this from the board while the probe is in wet soil or in a cup of water.</SettingHint>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="max-pump">Longest the pump may run before the board turns it off by itself (seconds)</Label>
          <Input
            id="max-pump"
            type="number"
            min={1}
            max={300}
            step={1}
            value={maxPumpOnSeconds}
            disabled={disabled || pending}
            onChange={(e) => setMaxPumpOnSeconds(e.target.value)}
          />
          <SettingHint>This is a last-resort stop on the board. HUMIS still decides when watering should start or stop.</SettingHint>
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-foreground">When HUMIS says pump ON, should the board pin go high or low?</p>
          <div className="flex gap-2">
            <Button
              type="button"
              className="flex-1"
              variant={relayActiveHigh ? 'default' : 'outline'}
              disabled={disabled || pending}
              onClick={() => setRelayActiveHigh(true)}
            >
              High (3.3V)
            </Button>
            <Button
              type="button"
              className="flex-1"
              variant={!relayActiveHigh ? 'default' : 'outline'}
              disabled={disabled || pending}
              onClick={() => setRelayActiveHigh(false)}
            >
              Low (0V)
            </Button>
          </div>
          <SettingHint>
            Try High first. If the pump runs when HUMIS says off, and sits still when HUMIS says on, switch to Low.
          </SettingHint>
        </div>
      </div>

      <MoreDetails>
        <p className="text-xs text-muted-foreground">
          Connected today: tank distance sensor (GPIO 5 and 18), Zone A soil (GPIO 34), pump relay (GPIO 26).
          Not wired yet: rain sensor, two flow sensors, Zone A valve, Zone B valve, second soil probe. HUMIS
          will not invent readings for those.
        </p>
        <p className="text-xs text-muted-foreground">
          Tank size (litres) is the box above. These distance numbers only tell HUMIS how full that tank is.
        </p>
      </MoreDetails>

      <div className="flex gap-2">
        <Button disabled={disabled || pending} onClick={() => void save()}>
          {pending ? 'Saving…' : 'Save sensor numbers'}
        </Button>
        <Button variant="outline" disabled={disabled || pending} onClick={() => void restore()}>
          Back to starter numbers
        </Button>
      </div>
      {message ? (
        <p className={`text-sm ${ok ? 'text-muted-foreground' : 'text-destructive'}`}>{message}</p>
      ) : null}
    </div>
  )
}
