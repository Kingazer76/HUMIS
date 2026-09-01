/**
 * PictoBlox may send JSON, form fields, or query-string values as strings.
 * This parser accepts those shapes and never invents a sensor that was
 * omitted or sent as null.
 */

export interface HardwareTelemetry {
  tankDistanceCm: number | null
  soilAdc: number | null
  pumpIsOn: boolean
  rainIsWet: boolean | null
  flowInHz: number | null
  flowOutHz: number | null
  ok: boolean
}

export interface HardwareCommand {
  pump: 0 | 1
  valveA: 0 | 1
  valveB: 0 | 1
  maxPumpOnSeconds: number
}

function isAbsent(value: unknown): boolean {
  return value === undefined || value === null || value === '' || value === 'null' || value === 'undefined'
}

function parseOptionalNumber(value: unknown): number | null {
  if (isAbsent(value)) return null
  const n = typeof value === 'number' ? value : Number(String(value).trim())
  return Number.isFinite(n) ? n : null
}

function parseOptionalBoolean(value: unknown): boolean | null {
  if (isAbsent(value)) return null
  if (value === true || value === 1) return true
  if (value === false || value === 0) return false
  const s = String(value).trim().toLowerCase()
  if (s === 'true' || s === '1' || s === 'yes' || s === 'wet') return true
  if (s === 'false' || s === '0' || s === 'no' || s === 'dry') return false
  return null
}

function parseRequiredBoolean(value: unknown, fallback: boolean): boolean {
  const parsed = parseOptionalBoolean(value)
  return parsed === null ? fallback : parsed
}

export type ParseTelemetryResult =
  | { ok: true; telemetry: HardwareTelemetry }
  | { ok: false; reason: string }

/**
 * Reads the agreed telemetry fields from a request body, form, or query.
 * Missing rain/flow fields become null (not connected). A missing pump
 * reading is rejected — HUMIS needs to know whether water is actually moving.
 */
export function parseTelemetry(raw: unknown): ParseTelemetryResult {
  if (raw === undefined || raw === null || typeof raw !== 'object') {
    return { ok: false, reason: 'Telemetry body must be an object.' }
  }
  const body = raw as Record<string, unknown>
  if (!('pumpIsOn' in body) && !('pump' in body)) {
    return { ok: false, reason: 'Telemetry must include pumpIsOn.' }
  }

  const pumpIsOn = parseRequiredBoolean(body.pumpIsOn ?? body.pump, false)
  const telemetry: HardwareTelemetry = {
    tankDistanceCm: parseOptionalNumber(body.tankDistanceCm),
    soilAdc: parseOptionalNumber(body.soilAdc),
    pumpIsOn,
    rainIsWet: parseOptionalBoolean(body.rainIsWet),
    flowInHz: parseOptionalNumber(body.flowInHz),
    flowOutHz: parseOptionalNumber(body.flowOutHz),
    ok: parseRequiredBoolean(body.ok, true),
  }
  return { ok: true, telemetry }
}

export function parseCommandPatch(raw: unknown): { pump?: 0 | 1; maxPumpOnSeconds?: number } | { error: string } {
  if (raw === undefined || raw === null || typeof raw !== 'object') {
    return { error: 'Command body must be an object.' }
  }
  const body = raw as Record<string, unknown>
  const patch: { pump?: 0 | 1; maxPumpOnSeconds?: number } = {}
  if ('pump' in body && !isAbsent(body.pump)) {
    const n = Number(body.pump)
    if (n !== 0 && n !== 1) return { error: 'pump must be 0 or 1.' }
    patch.pump = n as 0 | 1
  }
  if ('maxPumpOnSeconds' in body && !isAbsent(body.maxPumpOnSeconds)) {
    const n = Number(body.maxPumpOnSeconds)
    if (!Number.isFinite(n) || n < 1 || n > 300) {
      return { error: 'maxPumpOnSeconds must be between 1 and 300.' }
    }
    patch.maxPumpOnSeconds = Math.round(n)
  }
  return patch
}

export function commandToCsv(command: HardwareCommand): string {
  return `${command.pump},${command.valveA},${command.valveB},${command.maxPumpOnSeconds}`
}

export function commandToText(command: HardwareCommand): string {
  return `pump=${command.pump}&valveA=${command.valveA}&valveB=${command.valveB}&maxPumpOnSeconds=${command.maxPumpOnSeconds}`
}
