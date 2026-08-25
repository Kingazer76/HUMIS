import type {
  HistorySnapshot,
  IrrigationActionResult,
  IrrigationZone,
  OperationMode,
  PlanningSnapshot,
  SystemSnapshot,
  WaterSnapshot,
  WaterSource,
} from '@aquaflow/shared'

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path)
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

  startZone: (zoneId: string) => postJson<IrrigationActionResult>(`/api/irrigation/${zoneId}/start`),
  stopZone: (zoneId: string) => postJson<IrrigationActionResult>(`/api/irrigation/${zoneId}/stop`),
  setPumpState: (isOn: boolean) => postJson<IrrigationActionResult>('/api/irrigation/pump', { isOn }),
  setOperationMode: (mode: OperationMode) =>
    postJson<IrrigationActionResult>('/api/irrigation/mode', { mode }),
}
