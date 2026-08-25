import { describe, expect, it } from 'vitest'
import {
  HistoryLog,
  SNAPSHOT_EVERY_SIM_MINUTES,
  describeSoilCondition,
  type ZoneHistoryInput,
} from './historyLog.js'

function maizeField(overrides: Partial<ZoneHistoryInput> = {}): ZoneHistoryInput {
  return {
    id: 'zone-a',
    name: 'Zone A — North Field',
    cropName: 'Maize',
    soilMoisturePct: 35,
    minPct: 40,
    maxPct: 60,
    active: false,
    usedSinceStartL: 0,
    tag: 'simulated',
    ...overrides,
  }
}

describe('describeSoilCondition', () => {
  it('uses the zone min/max already used for irrigation (dry at or below min)', () => {
    expect(describeSoilCondition(40, 40, 60)).toBe('dry')
    expect(describeSoilCondition(39, 40, 60)).toBe('dry')
    expect(describeSoilCondition(50, 40, 60)).toBe('healthy')
    expect(describeSoilCondition(60, 40, 60)).toBe('wet')
  })
})

describe('HistoryLog', () => {
  it('starts empty', () => {
    const log = new HistoryLog()
    expect(log.size()).toBe(0)
    expect(log.list()).toEqual([])
  })

  it('records an irrigation start with the field, crop, soil, and simulated label', () => {
    const log = new HistoryLog()
    const record = log.recordIrrigationEvent({
      zone: maizeField({ soilMoisturePct: 35, active: true, usedSinceStartL: 10 }),
      wateringAction: 'started',
      tankLevelL: 9000,
      recordedAt: '2026-08-25T12:00:00.000Z',
    })

    expect(record.kind).toBe('irrigation-event')
    expect(record.tag).toBe('simulated')
    expect(record.zoneName).toBe('Zone A — North Field')
    expect(record.cropName).toBe('Maize')
    expect(record.soilCondition).toBe('dry')
    expect(record.wateringAction).toBe('started')
    expect(record.waterUsedL).toBe(0)
    expect(record.recordedAt).toBe('2026-08-25T12:00:00.000Z')
    expect(log.list()).toHaveLength(1)
  })

  it('attaches estimated water used for that watering session on stop', () => {
    const log = new HistoryLog()
    log.recordIrrigationEvent({
      zone: maizeField({ active: true, usedSinceStartL: 20 }),
      wateringAction: 'started',
      tankLevelL: 9000,
    })
    const stopped = log.recordIrrigationEvent({
      zone: maizeField({ soilMoisturePct: 62, active: false, usedSinceStartL: 95 }),
      wateringAction: 'stopped',
      tankLevelL: 8800,
    })

    expect(stopped.wateringAction).toBe('stopped')
    expect(stopped.waterUsedL).toBe(75)
    expect(stopped.soilCondition).toBe('wet')
    expect(stopped.tag).toBe('simulated')
  })

  it('records periodic farm snapshots after enough simulated minutes, with usage since the last snapshot', () => {
    const log = new HistoryLog()
    const first = log.ingestElapsed(SNAPSHOT_EVERY_SIM_MINUTES, {
      tankLevelL: 9700,
      zones: [maizeField({ active: true, usedSinceStartL: 40 })],
    })
    expect(first).toHaveLength(1)
    expect(first[0]?.kind).toBe('farm-snapshot')
    expect(first[0]?.wateringAction).toBe('watering')
    expect(first[0]?.waterUsedL).toBe(40)
    expect(first[0]?.tag).toBe('simulated')

    expect(
      log.ingestElapsed(SNAPSHOT_EVERY_SIM_MINUTES - 1, {
        tankLevelL: 9600,
        zones: [maizeField({ active: true, usedSinceStartL: 50 })],
      }),
    ).toEqual([])

    const second = log.ingestElapsed(1, {
      tankLevelL: 9600,
      zones: [maizeField({ active: false, usedSinceStartL: 55 })],
    })
    expect(second).toHaveLength(1)
    expect(second[0]?.waterUsedL).toBe(15)
    expect(second[0]?.wateringAction).toBe('idle')
  })

  it('does not write a snapshot before the interval has elapsed', () => {
    const log = new HistoryLog()
    expect(
      log.ingestElapsed(SNAPSHOT_EVERY_SIM_MINUTES - 1, {
        tankLevelL: 9700,
        zones: [maizeField()],
      }),
    ).toEqual([])
    expect(log.size()).toBe(0)
  })

  it('drops the oldest records once the log reaches its bound', () => {
    const log = new HistoryLog(3)
    for (let i = 0; i < 5; i += 1) {
      log.recordIrrigationEvent({
        zone: maizeField({ id: `zone-${i}`, name: `Field ${i}` }),
        wateringAction: 'started',
        tankLevelL: 9000,
        recordedAt: `2026-08-25T12:00:0${i}.000Z`,
      })
    }
    expect(log.size()).toBe(3)
    const names = log.list().map((r) => r.zoneName)
    expect(names).toEqual(['Field 4', 'Field 3', 'Field 2'])
  })

  it('lists newest records first', () => {
    const log = new HistoryLog()
    log.recordIrrigationEvent({
      zone: maizeField({ name: 'Older' }),
      wateringAction: 'started',
      tankLevelL: 9000,
      recordedAt: '2026-08-25T10:00:00.000Z',
    })
    log.recordIrrigationEvent({
      zone: maizeField({ name: 'Newer' }),
      wateringAction: 'stopped',
      tankLevelL: 9000,
      recordedAt: '2026-08-25T11:00:00.000Z',
    })
    expect(log.list().map((r) => r.zoneName)).toEqual(['Newer', 'Older'])
  })

  it('never reports negative water used', () => {
    const log = new HistoryLog()
    log.recordIrrigationEvent({
      zone: maizeField({ usedSinceStartL: 50 }),
      wateringAction: 'started',
      tankLevelL: 9000,
    })
    const stopped = log.recordIrrigationEvent({
      zone: maizeField({ usedSinceStartL: 10 }),
      wateringAction: 'stopped',
      tankLevelL: 9000,
    })
    expect(stopped.waterUsedL).toBe(0)
  })
})
