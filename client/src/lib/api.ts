import type {
  AssistantChatResponse,
  FarmLocation,
  HistorySnapshot,
  IrrigationActionResult,
  IrrigationAdviceSnapshot,
  IrrigationZone,
  OperationMode,
  PlanningSnapshot,
  SettingsActionResult,
  SettingsSnapshot,
  SpeechToTextResponse,
  SystemSnapshot,
  TankConfig,
  WaterSnapshot,
  WaterSource,
  TextToSpeechErrorResponse,
} from '@aquaflow/shared'
import { toFarmerVoiceMessage, VOICE_MESSAGES } from '@aquaflow/shared'
import { isNetworkFailure } from './voiceErrors'

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`${path} responded with ${res.status}`)
  return (await res.json()) as T
}

async function putJson<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`${path} responded with ${res.status}`)
  return (await res.json()) as T
}

async function postJson<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`${path} responded with ${res.status}`)
  return (await res.json()) as T
}

/**
 * Thin typed wrappers around the API. All requests go through Vite's `/api`
 * dev proxy to the Express server — the client never talks to the server's
 * port directly.
 *
 * The action methods (start/stop/setPumpState/setOperationMode) never touch
 * hardware themselves — they just call the corresponding
 * `/api/irrigation/*` route, which is the client-side mirror of "every
 * caller goes through safetyController, never the device provider
 * directly." A resolved promise with `ok: false` is a normal, expected
 * outcome (a safety interlock rejected the action) and must not be treated
 * as an error.
 */
export const api = {
  getWater: () => getJson<WaterSnapshot>('/api/water'),
  getSources: () => getJson<WaterSource[]>('/api/sources'),
  getZones: () => getJson<IrrigationZone[]>('/api/zones'),
  getSystem: () => getJson<SystemSnapshot>('/api/system'),
  getPlanning: () => getJson<PlanningSnapshot>('/api/planning'),
  getIrrigationAdvice: () => getJson<IrrigationAdviceSnapshot>('/api/irrigation/advice'),
  getHistory: () => getJson<HistorySnapshot>('/api/history'),
  getSettings: () => getJson<SettingsSnapshot>('/api/settings'),

  saveTank: (tank: TankConfig) => putJson<SettingsActionResult>('/api/settings/tank', tank),
  restoreTankDefaults: () => postJson<SettingsActionResult>('/api/settings/tank/defaults'),
  saveLocation: (location: FarmLocation) => putJson<SettingsActionResult>('/api/settings/location', location),
  restoreLocationDefaults: () => postJson<SettingsActionResult>('/api/settings/location/defaults'),
  saveZone: (
    zoneId: string,
    body: {
      name: string
      cropId: string
      irrigationPreference: IrrigationZone['irrigationPreference']
      sensorMode?: IrrigationZone['sensorMode']
      overrideMinPct?: number | null
      overrideMaxPct?: number | null
      soilId?: IrrigationZone['soilId']
      growthStageId?: string
    },
  ) => putJson<SettingsActionResult>(`/api/settings/zones/${zoneId}`, body),
  resetZone: (zoneId: string) => postJson<SettingsActionResult>(`/api/settings/zones/${zoneId}/reset`),

  startZone: (zoneId: string) => postJson<IrrigationActionResult>(`/api/irrigation/${zoneId}/start`),
  stopZone: (zoneId: string) => postJson<IrrigationActionResult>(`/api/irrigation/${zoneId}/stop`),
  setPumpState: (isOn: boolean) => postJson<IrrigationActionResult>('/api/irrigation/pump', { isOn }),
  setOperationMode: (mode: OperationMode) =>
    postJson<IrrigationActionResult>('/api/irrigation/mode', { mode }),
  sendAssistantMessage: (message: string, language?: string) =>
    postJson<AssistantChatResponse>('/api/assistant/chat', language ? { message, language } : { message }),
  transcribeSpeech: async (
    audio: Blob,
    signal?: AbortSignal,
    language?: string,
  ): Promise<SpeechToTextResponse> => {
    try {
      const path = language
        ? `/api/assistant/speech?language=${encodeURIComponent(language)}`
        : '/api/assistant/speech'
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': audio.type || 'audio/wav' },
        body: audio,
        signal,
      })
      let body: SpeechToTextResponse | undefined
      try {
        body = (await res.json()) as SpeechToTextResponse
      } catch {
        return { ok: false, reason: VOICE_MESSAGES.generic }
      }
      if (!body || typeof body !== 'object') {
        return { ok: false, reason: VOICE_MESSAGES.generic }
      }
      if (!res.ok || !body.ok) {
        return {
          ok: false,
          reason: toFarmerVoiceMessage(body.reason, VOICE_MESSAGES.couldNotUnderstand),
        }
      }
      const text = typeof body.text === 'string' ? body.text.trim() : ''
      if (!text) {
        return { ok: false, reason: VOICE_MESSAGES.couldNotUnderstand }
      }
      return { ok: true, text }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') throw err
      if (isNetworkFailure(err)) {
        return { ok: false, reason: VOICE_MESSAGES.noInternet }
      }
      return { ok: false, reason: VOICE_MESSAGES.generic }
    }
  },
  speakAssistantReply: async (text: string, signal?: AbortSignal, language?: string): Promise<Blob> => {
    try {
      const res = await fetch('/api/assistant/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(language ? { text, language } : { text }),
        signal,
      })
      const type = res.headers.get('content-type') ?? ''
      if (res.ok && type.includes('audio')) {
        const blob = await res.blob()
        if (blob.size < 12) throw new Error(VOICE_MESSAGES.speakFailed)
        return blob
      }
      let reason = VOICE_MESSAGES.speakFailed
      if (type.includes('json')) {
        try {
          const body = (await res.json()) as TextToSpeechErrorResponse
          reason = toFarmerVoiceMessage(body.reason, VOICE_MESSAGES.speakFailed)
        } catch {
          // Keep the default farmer message.
        }
      }
      throw new Error(reason)
    } catch (err) {
      if (signal?.aborted || (err instanceof Error && err.name === 'AbortError')) throw err
      if (isNetworkFailure(err)) throw new Error(VOICE_MESSAGES.noInternet)
      if (err instanceof Error && err.message.trim()) {
        throw new Error(toFarmerVoiceMessage(err.message, VOICE_MESSAGES.speakFailed))
      }
      throw new Error(VOICE_MESSAGES.speakFailed)
    }
  },
}
