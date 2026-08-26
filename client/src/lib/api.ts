import type {
  AssistantChatResponse,
  FarmLocation,
  HistorySnapshot,
  IrrigationActionResult,
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
    },
  ) => putJson<SettingsActionResult>(`/api/settings/zones/${zoneId}`, body),
  resetZone: (zoneId: string) => postJson<SettingsActionResult>(`/api/settings/zones/${zoneId}/reset`),

  startZone: (zoneId: string) => postJson<IrrigationActionResult>(`/api/irrigation/${zoneId}/start`),
  stopZone: (zoneId: string) => postJson<IrrigationActionResult>(`/api/irrigation/${zoneId}/stop`),
  setPumpState: (isOn: boolean) => postJson<IrrigationActionResult>('/api/irrigation/pump', { isOn }),
  setOperationMode: (mode: OperationMode) =>
    postJson<IrrigationActionResult>('/api/irrigation/mode', { mode }),
  sendAssistantMessage: (message: string) =>
    postJson<AssistantChatResponse>('/api/assistant/chat', { message }),
  transcribeSpeech: async (audio: Blob): Promise<SpeechToTextResponse> => {
    const res = await fetch('/api/assistant/speech', {
      method: 'POST',
      headers: { 'Content-Type': audio.type || 'audio/wav' },
      body: audio,
    })
    if (!res.ok) throw new Error(`/api/assistant/speech responded with ${res.status}`)
    return (await res.json()) as SpeechToTextResponse
  },
  speakAssistantReply: async (text: string, signal?: AbortSignal): Promise<Blob> => {
    const res = await fetch('/api/assistant/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal,
    })
    const type = res.headers.get('content-type') ?? ''
    if (type.includes('audio')) {
      return await res.blob()
    }
    let reason = "Couldn't speak that. The written answer is still on screen."
    try {
      const body = (await res.json()) as TextToSpeechErrorResponse
      if (body.reason) reason = body.reason
    } catch {
      // Keep the default farmer message.
    }
    throw new Error(reason)
  },
}
