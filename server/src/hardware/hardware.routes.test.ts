import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { resetFarmSettingsForTests } from '../config/farmSettings.js'
import { simulatedProvider } from '../providers/index.js'
import { resetHardwareStoreForTests } from './hardwareStore.js'

const app = createApp()
const KEY = 'test-hardware-key'

beforeEach(() => {
  process.env.HUMIS_HARDWARE_KEY = KEY
  resetHardwareStoreForTests()
  resetFarmSettingsForTests()
  simulatedProvider?.resetForTests()
})

afterEach(() => {
  resetHardwareStoreForTests()
  resetFarmSettingsForTests()
  delete process.env.HUMIS_HARDWARE_KEY
})

describe('hardware HTTP (no farmer login)', () => {
  it('rejects telemetry without the hardware key', async () => {
    const res = await request(app).post('/api/hardware/telemetry').send({
      tankDistanceCm: 42,
      soilAdc: 1800,
      pumpIsOn: false,
      ok: true,
    })
    expect(res.status).toBe(401)
  })

  it('accepts the agreed telemetry JSON with ?key=', async () => {
    const res = await request(app)
      .post(`/api/hardware/telemetry?key=${KEY}`)
      .send({
        tankDistanceCm: 42.0,
        soilAdc: 1800,
        pumpIsOn: false,
        rainIsWet: null,
        flowInHz: null,
        flowOutHz: null,
        ok: true,
      })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('returns the agreed command shape, with valves off while they are unwired', async () => {
    const res = await request(app).get(`/api/hardware/command?key=${KEY}`)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      pump: 0,
      valveA: 0,
      valveB: 0,
      maxPumpOnSeconds: 30,
    })
  })

  it('returns a comma list when PictoBlox asks for csv', async () => {
    const res = await request(app).get(`/api/hardware/command?key=${KEY}&format=csv`)
    expect(res.status).toBe(200)
    expect(res.text).toBe('0,0,0,30')
  })

  it('accepts form-encoded telemetry like PictoBlox may send', async () => {
    const res = await request(app)
      .post(`/api/hardware/telemetry?key=${KEY}`)
      .type('form')
      .send({
        tankDistanceCm: '42.0',
        soilAdc: '1800',
        pumpIsOn: 'false',
        ok: 'true',
      })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('lets the board be tested while the practice farm stays on', async () => {
    const before = await simulatedProvider!.getZones()
    const zoneABefore = before.find((z) => z.id === 'zone-a')!.state.soilMoisturePct.value

    await request(app).post(`/api/hardware/telemetry?key=${KEY}`).send({
      tankDistanceCm: 42,
      soilAdc: 1800,
      pumpIsOn: false,
      ok: true,
    })
    await request(app).post(`/api/hardware/command?key=${KEY}`).send({ pump: 1, maxPumpOnSeconds: 10 })

    const after = await simulatedProvider!.getZones()
    const zoneAAfter = after.find((z) => z.id === 'zone-a')!.state.soilMoisturePct.value
    expect(zoneAAfter).toBe(zoneABefore)

    const pump = await simulatedProvider!.getPumpStatus()
    expect(pump.isOn.value).toBe(false)

    const command = await request(app).get(`/api/hardware/command?key=${KEY}`)
    expect(command.body.pump).toBe(1)
    expect(command.body.valveA).toBe(0)
    expect(command.body.valveB).toBe(0)
  })

  it('does not require a farmer cookie, and farm APIs still do', async () => {
    const hardware = await request(app).get(`/api/hardware/command?key=${KEY}`)
    expect(hardware.status).toBe(200)
    const water = await request(app).get('/api/water')
    expect(water.status).toBe(401)
  })
})
