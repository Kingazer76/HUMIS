import { describe, expect, it } from 'vitest'
import type { IrrigationZone } from '@aquaflow/shared'
import { parseIntent } from './parseIntent.js'

const zones = [
  {
    id: 'zone-a',
    name: 'Zone A — North Field',
    crop: { name: 'Maize' },
  },
  {
    id: 'zone-b',
    name: 'Zone B — South Field',
    crop: { name: 'Tomato' },
  },
] as IrrigationZone[]

describe('parseIntent', () => {
  it('treats tank questions as tank, not as a watering action', () => {
    expect(parseIntent('How much water is in the tank?')).toEqual({ type: 'question', topic: 'tank' })
  })

  it('maps days remaining questions', () => {
    expect(parseIntent('How many days of water do I have left?')).toEqual({
      type: 'question',
      topic: 'days',
    })
  })

  it('maps shortage questions', () => {
    expect(parseIntent('Is there a shortage risk?')).toEqual({ type: 'question', topic: 'shortage' })
  })

  it('maps soil questions', () => {
    expect(parseIntent('Do my crops need water?')).toEqual({ type: 'question', topic: 'soil' })
  })

  it('maps weather questions', () => {
    expect(parseIntent('Is it raining?')).toEqual({ type: 'question', topic: 'weather' })
  })

  it('maps watering status questions', () => {
    expect(parseIntent('Are we watering right now?')).toEqual({ type: 'question', topic: 'irrigation' })
  })

  it('maps start watering to a safety-gated action', () => {
    expect(parseIntent('Please start watering', zones)).toEqual({
      type: 'action',
      action: 'start-watering',
      zoneId: undefined,
    })
  })

  it('picks a named field for start watering', () => {
    expect(parseIntent('Start watering the north field', zones)).toMatchObject({
      type: 'action',
      action: 'start-watering',
      zoneId: 'zone-a',
    })
  })

  it('maps pump on/off separately from field watering', () => {
    expect(parseIntent('Turn on the pump')).toEqual({ type: 'action', action: 'start-pump' })
    expect(parseIntent('Turn off the pump')).toEqual({ type: 'action', action: 'stop-pump' })
  })

  it('maps stop watering', () => {
    expect(parseIntent('Stop watering')).toEqual({ type: 'action', action: 'stop-watering', zoneId: undefined })
  })

  it('maps auto and manual mode', () => {
    expect(parseIntent('Switch to manual')).toEqual({ type: 'action', action: 'mode-manual' })
    expect(parseIntent('Switch to auto')).toEqual({ type: 'action', action: 'mode-auto' })
  })

  it('treats advice questions as questions, not watering actions', () => {
    expect(parseIntent('Should I irrigate now?')).toEqual({ type: 'question', topic: 'irrigation' })
    expect(parseIntent('Is the soil dry?')).toEqual({ type: 'question', topic: 'soil' })
  })

  it('does not map a misheard pump word to a pump action', () => {
    expect(parseIntent('Turn on the comb.')).toEqual({
      type: 'clarify',
      suggestion: 'turn on the pump',
      pendingAction: { action: 'start-pump' },
    })
  })

  it('asks to start irrigation when start has no known target', () => {
    expect(parseIntent('Start the machine')).toEqual({
      type: 'clarify',
      suggestion: 'start irrigation',
      pendingAction: { action: 'start-watering' },
    })
  })

  it('marks leftover speech as unclear instead of a general farm dump', () => {
    expect(parseIntent('asdfghjk')).toEqual({ type: 'unclear' })
    expect(parseIntent('hmm')).toEqual({ type: 'unclear' })
    expect(parseIntent('I like bananas')).toEqual({ type: 'unclear' })
  })

  it('maps short yes and no for a later confirm step', () => {
    expect(parseIntent('Yes')).toEqual({ type: 'confirm' })
    expect(parseIntent('No')).toEqual({ type: 'cancel' })
  })
})
