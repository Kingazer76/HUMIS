import type { IrrigationZone } from '@aquaflow/shared'

export type QuestionTopic =
  | 'tank'
  | 'days'
  | 'shortage'
  | 'soil'
  | 'irrigation'
  | 'weather'
  | 'help'
  | 'general'

export type AssistantIntent =
  | { type: 'question'; topic: QuestionTopic }
  | {
      type: 'action'
      action: 'start-pump' | 'stop-pump' | 'start-watering' | 'stop-watering' | 'mode-auto' | 'mode-manual'
      zoneId?: string
    }

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

/**
 * Small keyword matcher. No extra libraries. Actions win over questions
 * so "start watering" is never treated as a status question.
 */
export function parseIntent(message: string, zones: IrrigationZone[] = []): AssistantIntent {
  const text = normalize(message)
  const zone = matchZone(text, zones)

  const wantsAuto = /\b(switch|go|set|use|change|turn).{0,12}\bauto\b/.test(text) || text.includes('switch to auto')
  const wantsManual =
    /\b(switch|go|set|use|change|turn).{0,12}\bmanual\b/.test(text) || text.includes('switch to manual')

  if (wantsManual) return { type: 'action', action: 'mode-manual' }
  if (wantsAuto) return { type: 'action', action: 'mode-auto' }

  const mentionsPump = /\bpump\b/.test(text)
  const mentionsWatering = /\b(water|watering|irrigation|irrigate|field|fields|crops?)\b/.test(text)
  const startVerb = /\b(start|begin|turn on|switch on|open|water now)\b/.test(text) || text.includes('water now')
  const stopVerb = /\b(stop|halt|turn off|switch off|shut off|close)\b/.test(text)

  if (mentionsPump && startVerb) return { type: 'action', action: 'start-pump' }
  if (mentionsPump && stopVerb) return { type: 'action', action: 'stop-pump' }
  if (stopVerb && mentionsWatering) {
    return { type: 'action', action: 'stop-watering', zoneId: zone?.id }
  }
  if (startVerb && mentionsWatering) {
    return { type: 'action', action: 'start-watering', zoneId: zone?.id }
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
  if (/\b(watering|irrigation|pump|valve)\b/.test(text)) {
    return { type: 'question', topic: 'irrigation' }
  }

  return { type: 'question', topic: 'general' }
}
