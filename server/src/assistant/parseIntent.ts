import type { IrrigationZone } from '@aquaflow/shared'

export type QuestionTopic = 'tank' | 'days' | 'shortage' | 'soil' | 'irrigation' | 'weather' | 'help'

export type AssistantAction =
  | 'start-pump'
  | 'stop-pump'
  | 'start-watering'
  | 'stop-watering'
  | 'mode-auto'
  | 'mode-manual'

export type PendingAction = {
  action: AssistantAction
  zoneId?: string
}

export type AssistantIntent =
  | { type: 'question'; topic: QuestionTopic }
  | { type: 'action'; action: AssistantAction; zoneId?: string }
  | { type: 'clarify'; suggestion: string; pendingAction: PendingAction }
  | { type: 'confirm' }
  | { type: 'cancel' }
  | { type: 'unclear' }

function normalize(message: string): string {
  return message.toLowerCase().replace(/['’]/g, '').replace(/\s+/g, ' ').trim()
}

export function matchZone(text: string, zones: IrrigationZone[]): IrrigationZone | undefined {
  const t = normalize(text)
  return zones.find((zone) => {
    const name = zone.name.toLowerCase()
    const crop = zone.crop.name.toLowerCase()
    return (
      t.includes(zone.id.toLowerCase()) ||
      t.includes(name) ||
      t.includes(crop) ||
      (name.includes('north') && t.includes('north')) ||
      (name.includes('south') && t.includes('south')) ||
      (/\bzone a\b/.test(t) && zone.id === 'zone-a') ||
      (/\bzone b\b/.test(t) && zone.id === 'zone-b')
    )
  })
}

function isConfirm(text: string): boolean {
  return /^(yes|yeah|yep|yup|ok|okay|sure|please|do it|go ahead|confirm|thats right|that is right|correct|please do)[.!?]?$/.test(
    text,
  )
}

function isCancel(text: string): boolean {
  return /^(no|nope|nah|cancel|never ?mind|dont|not that)[.!?]?$/.test(text)
}

function askingAdvice(text: string): boolean {
  return /\b(should i|do i need|do my|can i|is it (a )?good)\b/.test(text)
}

/**
 * Small keyword matcher. No extra libraries. Actions win over questions
 * so "start watering" is never treated as a status question.
 *
 * Unrecognized speech is unclear — never a generic farm-status dump.
 * A start/stop phrase with no known target asks for confirmation instead
 * of silently turning hardware on.
 */
export function parseIntent(message: string, zones: IrrigationZone[] = []): AssistantIntent {
  const text = normalize(message)
  if (!text) return { type: 'unclear' }

  if (isConfirm(text)) return { type: 'confirm' }
  if (isCancel(text)) return { type: 'cancel' }

  const zone = matchZone(text, zones)

  const wantsAuto = /\b(switch|go|set|use|change|turn).{0,12}\bauto\b/.test(text) || text.includes('switch to auto')
  const wantsManual =
    /\b(switch|go|set|use|change|turn).{0,12}\bmanual\b/.test(text) || text.includes('switch to manual')

  if (wantsManual) return { type: 'action', action: 'mode-manual' }
  if (wantsAuto) return { type: 'action', action: 'mode-auto' }

  const mentionsPump = /\bpump\b/.test(text)
  const mentionsWatering = /\b(water|watering|irrigation|irrigate|field|fields|crops?)\b/.test(text)
  const startVerb =
    /\b(start|begin|turn on|switch on|open|water now)\b/.test(text) ||
    text.includes('water now') ||
    /\bturn\b.{0,16}\bon\b/.test(text)
  const stopVerb =
    /\b(stop|halt|turn off|switch off|shut off|close)\b/.test(text) || /\bturn\b.{0,16}\boff\b/.test(text)

  if (!askingAdvice(text)) {
    if (mentionsPump && startVerb) return { type: 'action', action: 'start-pump' }
    if (mentionsPump && stopVerb) return { type: 'action', action: 'stop-pump' }
    if (stopVerb && mentionsWatering) {
      return { type: 'action', action: 'stop-watering', zoneId: zone?.id }
    }
    if (startVerb && mentionsWatering) {
      return { type: 'action', action: 'start-watering', zoneId: zone?.id }
    }

    const turnOn = /\b(turn on|switch on)\b/.test(text) || /\bturn\b.{0,16}\bon\b/.test(text)
    const turnOff = /\b(turn off|switch off|shut off)\b/.test(text) || /\bturn\b.{0,16}\boff\b/.test(text)
    const startLike = /\b(start|begin)\b/.test(text)
    const stopLike = /\b(stop|halt)\b/.test(text)

    if (turnOn) {
      return {
        type: 'clarify',
        suggestion: 'turn on the pump',
        pendingAction: { action: 'start-pump' },
      }
    }
    if (turnOff) {
      return {
        type: 'clarify',
        suggestion: 'turn off the pump',
        pendingAction: { action: 'stop-pump' },
      }
    }
    if (startLike) {
      return {
        type: 'clarify',
        suggestion: 'start irrigation',
        pendingAction: { action: 'start-watering' },
      }
    }
    if (stopLike) {
      return {
        type: 'clarify',
        suggestion: 'stop irrigation',
        pendingAction: { action: 'stop-watering' },
      }
    }
  }

  if (/\b(help|hello|hi|what can you|what do you)\b/.test(text)) {
    return { type: 'question', topic: 'help' }
  }
  if (/\b(shortage|run out|run low|risk)\b/.test(text)) {
    return { type: 'question', topic: 'shortage' }
  }
  if (/\b(days remaining|days left|how many days|how long)\b/.test(text)) {
    return { type: 'question', topic: 'days' }
  }
  if (/\b(tank|water level|how much water|stored water|litres|liters)\b/.test(text)) {
    return { type: 'question', topic: 'tank' }
  }
  if (/\b(rain|raining|weather|forecast)\b/.test(text)) {
    return { type: 'question', topic: 'weather' }
  }
  if (/\b(soil|crop|crops|field|fields|dry|moisture|maize|tomato)\b/.test(text)) {
    return { type: 'question', topic: 'soil' }
  }
  if (/\b(watering|irrigation|irrigate|pump|valve)\b/.test(text)) {
    return { type: 'question', topic: 'irrigation' }
  }

  return { type: 'unclear' }
}
