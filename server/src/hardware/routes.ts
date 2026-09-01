import { Router } from 'express'
import { getHardwareCalibration } from '../config/farmSettings.js'
import { USE_SIMULATED } from '../env.js'
import { isValidUltrasonicCm } from './conversions.js'
import { hardwarePinMap } from './gpioPins.js'
import { requireHardwareKey } from './hardwareAuth.js'
import {
  applyTestCommand,
  forcePumpOff,
  getHardwareCommand,
  getLastTelemetry,
  isTelemetryFresh,
  recordTelemetry,
  telemetryAgeMs,
} from './hardwareStore.js'
import { commandToCsv, commandToText, parseCommandPatch, parseTelemetry } from './parseTelemetry.js'

export const hardwareRouter = Router()

hardwareRouter.use(requireHardwareKey)

function maybeForcePumpOffFromTelemetry(): void {
  if (USE_SIMULATED) return
  const telemetry = getLastTelemetry()
  if (!telemetry || !isTelemetryFresh() || telemetry.ok === false || !isValidUltrasonicCm(telemetry.tankDistanceCm)) {
    forcePumpOff()
  }
}

hardwareRouter.post('/telemetry', (req, res) => {
  const parsed = parseTelemetry({ ...req.query, ...req.body })
  if (!parsed.ok) {
    res.status(400).json({ ok: false, reason: parsed.reason })
    return
  }
  const stored = recordTelemetry(parsed.telemetry)
  maybeForcePumpOffFromTelemetry()
  res.json({
    ok: true,
    receivedAt: new Date(stored.receivedAt).toISOString(),
    command: getHardwareCommand(),
  })
})

hardwareRouter.get('/command', (req, res) => {
  maybeForcePumpOffFromTelemetry()
  const command = getHardwareCommand()
  const format = typeof req.query.format === 'string' ? req.query.format.trim().toLowerCase() : 'json'
  res.setHeader('Cache-Control', 'no-store')
  if (format === 'csv') {
    res.type('text/plain').send(commandToCsv(command))
    return
  }
  if (format === 'text') {
    res.type('text/plain').send(commandToText(command))
    return
  }
  res.json({
    pump: command.pump,
    valveA: command.valveA,
    valveB: command.valveB,
    maxPumpOnSeconds: command.maxPumpOnSeconds,
  })
})

/**
 * Bench-test only. Turns the real pump from a key-authenticated POST
 * without going through the farm irrigation brain. While the practice
 * farm is on, irrigation buttons still do not write this command.
 */
hardwareRouter.post('/command', (req, res) => {
  const patch = parseCommandPatch({ ...req.query, ...req.body })
  if ('error' in patch) {
    res.status(400).json({ ok: false, reason: patch.error })
    return
  }
  const command = applyTestCommand(patch)
  res.json({
    ok: true,
    pump: command.pump,
    valveA: command.valveA,
    valveB: command.valveB,
    maxPumpOnSeconds: command.maxPumpOnSeconds,
  })
})

hardwareRouter.get('/status', (_req, res) => {
  const telemetry = getLastTelemetry()
  const command = getHardwareCommand()
  res.json({
    ok: true,
    useSimulated: USE_SIMULATED,
    calibration: getHardwareCalibration(),
    pins: hardwarePinMap(),
    lastTelemetry: telemetry
      ? {
          ...telemetry,
          receivedAt: new Date(telemetry.receivedAt).toISOString(),
          ageMs: telemetryAgeMs(),
          fresh: isTelemetryFresh(),
        }
      : null,
    command: {
      pump: command.pump,
      valveA: command.valveA,
      valveB: command.valveB,
      maxPumpOnSeconds: command.maxPumpOnSeconds,
    },
  })
})
