import { getHardwareCalibration } from '../config/farmSettings.js'
import { isPinAssigned, UNASSIGNED_GPIO } from './gpioPins.js'
import type { HardwareCommand, HardwareTelemetry } from './parseTelemetry.js'

export interface StoredTelemetry extends HardwareTelemetry {
  receivedAt: number
}

interface StoredCommand extends HardwareCommand {
  updatedAt: number
}

const TELEMETRY_STALE_MS = 15_000

let lastTelemetry: StoredTelemetry | null = null
let command: StoredCommand = {
  pump: 0,
  valveA: 0,
  valveB: 0,
  maxPumpOnSeconds: getHardwareCalibration().maxPumpOnSeconds,
  updatedAt: Date.now(),
}

function clampBit(value: 0 | 1, pin: number | null): 0 | 1 {
  return isPinAssigned(pin) ? value : 0
}

export function recordTelemetry(telemetry: HardwareTelemetry, receivedAt = Date.now()): StoredTelemetry {
  lastTelemetry = { ...telemetry, receivedAt }
  return lastTelemetry
}

export function getLastTelemetry(): StoredTelemetry | null {
  return lastTelemetry ? { ...lastTelemetry } : null
}

export function telemetryAgeMs(now = Date.now()): number | null {
  if (!lastTelemetry) return null
  return Math.max(0, now - lastTelemetry.receivedAt)
}

export function isTelemetryFresh(now = Date.now(), maxAgeMs = TELEMETRY_STALE_MS): boolean {
  const age = telemetryAgeMs(now)
  return age !== null && age <= maxAgeMs
}

export function getHardwareCommand(): HardwareCommand & { updatedAt: number } {
  const calibration = getHardwareCalibration()
  return {
    pump: command.pump,
    valveA: clampBit(command.valveA, UNASSIGNED_GPIO.ZONE_A_VALVE_PIN),
    valveB: clampBit(command.valveB, UNASSIGNED_GPIO.ZONE_B_VALVE_PIN),
    maxPumpOnSeconds: command.maxPumpOnSeconds || calibration.maxPumpOnSeconds,
    updatedAt: command.updatedAt,
  }
}

export function setPumpCommand(isOn: boolean): void {
  const next: 0 | 1 = isOn ? 1 : 0
  if (command.pump === next) return
  command = { ...command, pump: next, updatedAt: Date.now() }
}

export function setValveCommand(zoneId: string, isOn: boolean): void {
  const bit: 0 | 1 = isOn ? 1 : 0
  if (zoneId === 'zone-a') {
    const valveA = clampBit(bit, UNASSIGNED_GPIO.ZONE_A_VALVE_PIN)
    if (command.valveA === valveA) return
    command = { ...command, valveA, updatedAt: Date.now() }
    return
  }
  if (zoneId === 'zone-b') {
    const valveB = clampBit(bit, UNASSIGNED_GPIO.ZONE_B_VALVE_PIN)
    if (command.valveB === valveB) return
    command = { ...command, valveB, updatedAt: Date.now() }
  }
}

export function setMaxPumpOnSeconds(seconds: number): void {
  const maxPumpOnSeconds = Math.min(300, Math.max(1, Math.round(seconds)))
  if (command.maxPumpOnSeconds === maxPumpOnSeconds) return
  command = { ...command, maxPumpOnSeconds, updatedAt: Date.now() }
}

export function forcePumpOff(): void {
  setPumpCommand(false)
}

/** Independent bench-test command. Does not go through the farm irrigation brain. */
export function applyTestCommand(patch: { pump?: 0 | 1; maxPumpOnSeconds?: number }): HardwareCommand {
  if (patch.maxPumpOnSeconds !== undefined) setMaxPumpOnSeconds(patch.maxPumpOnSeconds)
  if (patch.pump !== undefined) {
    command = { ...command, pump: patch.pump, updatedAt: Date.now() }
  }
  return getHardwareCommand()
}

export function resetHardwareStoreForTests(): void {
  lastTelemetry = null
  command = {
    pump: 0,
    valveA: 0,
    valveB: 0,
    maxPumpOnSeconds: getHardwareCalibration().maxPumpOnSeconds,
    updatedAt: Date.now(),
  }
}

export { TELEMETRY_STALE_MS }
