import { describe, expect, it } from 'vitest'
import { commandToCsv, parseTelemetry } from './parseTelemetry.js'

describe('parseTelemetry', () => {
  it('accepts the agreed JSON shape and keeps unconnected sensors as null', () => {
    const parsed = parseTelemetry({
      tankDistanceCm: 42.0,
      soilAdc: 1800,
      pumpIsOn: false,
      rainIsWet: null,
      flowInHz: null,
      flowOutHz: null,
      ok: true,
    })
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.telemetry).toEqual({
      tankDistanceCm: 42,
      soilAdc: 1800,
      pumpIsOn: false,
      rainIsWet: null,
      flowInHz: null,
      flowOutHz: null,
      ok: true,
    })
  })

  it('accepts PictoBlox form strings and omitted rain/flow fields', () => {
    const parsed = parseTelemetry({
      tankDistanceCm: '42.0',
      soilAdc: '1800',
      pumpIsOn: 'false',
      ok: 'true',
    })
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.telemetry.tankDistanceCm).toBe(42)
    expect(parsed.telemetry.soilAdc).toBe(1800)
    expect(parsed.telemetry.pumpIsOn).toBe(false)
    expect(parsed.telemetry.rainIsWet).toBeNull()
    expect(parsed.telemetry.flowInHz).toBeNull()
  })

  it('does not invent a rain reading from a missing field', () => {
    const parsed = parseTelemetry({ tankDistanceCm: 10, soilAdc: 1000, pumpIsOn: 0 })
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.telemetry.rainIsWet).toBeNull()
  })

  it('rejects a body with no pump reading', () => {
    const parsed = parseTelemetry({ tankDistanceCm: 42, soilAdc: 1800 })
    expect(parsed.ok).toBe(false)
  })
})

describe('commandToCsv', () => {
  it('is split-friendly for PictoBlox', () => {
    expect(commandToCsv({ pump: 1, valveA: 0, valveB: 0, maxPumpOnSeconds: 30 })).toBe('1,0,0,30')
  })
})
