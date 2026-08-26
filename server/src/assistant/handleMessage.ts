import type { AssistantChatResponse, IrrigationActionResult, IrrigationZone } from '@aquaflow/shared'
import { safetyController } from '../irrigation/safetyController.js'
import { answerQuestion } from './answerQuestion.js'
import { loadFarmState } from './loadFarmState.js'
import { parseIntent, type AssistantIntent } from './parseIntent.js'

function farmerBlock(reason: string): string {
  if (/critical threshold/i.test(reason)) {
    return 'The tank is at or below the critical water level, so new watering cannot start until more water is stored.'
  }
  if (/manual mode/i.test(reason)) {
    return 'The pump can only be turned on or off in Manual mode. Ask me to switch to Manual first, or use the Irrigation tab.'
  }
  if (/stale/i.test(reason)) {
    return 'A sensor reading is too old, so watering was blocked for safety.'
  }
  if (/invalid/i.test(reason)) {
    return 'A soil reading did not look valid, so watering was blocked for safety.'
  }
  if (/too recently/i.test(reason)) {
    return 'That field changed too recently. Waiting a short moment avoids flipping the water on and off too fast.'
  }
  if (/unknown zone/i.test(reason)) {
    return 'I could not find that field.'
  }
  return reason
}

function describeResult(attempt: string, result: IrrigationActionResult): string {
  if (result.ok) {
    return `Done. ${result.reason}.`
  }
  return `I could not ${attempt}. The safety gate blocked it.\n\n${farmerBlock(result.reason)}`
}

async function runZoneAction(
  zones: IrrigationZone[],
  active: boolean,
  zoneId: string | undefined,
): Promise<{ reply: string; action?: IrrigationActionResult }> {
  const verb = active ? 'start watering' : 'stop watering'
  const targets = zoneId
    ? zones.filter((z) => z.id === zoneId)
    : zones.filter((z) => z.state.active === !active)

  if (zoneId && targets.length === 0) {
    return { reply: 'I could not find that field. Try Zone A, Zone B, North Field, or South Field.' }
  }
  if (targets.length === 0) {
    return {
      reply: active
        ? 'The fields are already watering, or there is no field to start.'
        : 'No field is watering right now, so there is nothing to stop.',
    }
  }

  const results: IrrigationActionResult[] = []
  for (const zone of targets) {
    results.push(await safetyController.setZoneActive(zone.id, active, 'manual'))
  }

  const blocked = results.filter((r) => !r.ok)
  const last = results[results.length - 1]
  if (blocked.length === results.length && last) {
    return { reply: describeResult(verb, last), action: last }
  }
  if (blocked.length > 0 && last) {
    return {
      reply: `${describeResult(verb, blocked[0] ?? last)}\n\nSome fields may have started; check the Irrigation tab.`,
      action: blocked[0] ?? last,
    }
  }
  const names = targets.map((z) => z.name).join(', ')
  return {
    reply: active ? `Started watering: ${names}.` : `Stopped watering: ${names}.`,
    action: last,
  }
}

async function performAction(intent: Extract<AssistantIntent, { type: 'action' }>): Promise<{
  reply: string
  action?: IrrigationActionResult
}> {
  const farm = await loadFarmState()

  if (intent.action === 'mode-auto') {
    const action = await safetyController.setOperationMode('auto')
    return { reply: describeResult('switch to Auto', action), action }
  }
  if (intent.action === 'mode-manual') {
    const action = await safetyController.setOperationMode('manual')
    return { reply: describeResult('switch to Manual', action), action }
  }
  if (intent.action === 'start-pump') {
    const action = await safetyController.setPumpState(true)
    return { reply: describeResult('turn the pump on', action), action }
  }
  if (intent.action === 'stop-pump') {
    const action = await safetyController.setPumpState(false)
    return { reply: describeResult('turn the pump off', action), action }
  }
  if (intent.action === 'start-watering') {
    return runZoneAction(farm.zones, true, intent.zoneId)
  }
  return runZoneAction(farm.zones, false, intent.zoneId)
}

export async function handleAssistantMessage(message: string): Promise<AssistantChatResponse> {
  const farm = await loadFarmState()
  const intent = parseIntent(message, farm.zones)

  if (intent.type === 'action') {
    return performAction(intent)
  }

  return { reply: answerQuestion(intent.topic, farm) }
}
