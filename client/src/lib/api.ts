import type { IrrigationZone, SystemSnapshot, WaterSnapshot, WaterSource } from '@aquaflow/shared'

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`${path} responded with ${res.status}`)
  return (await res.json()) as T
}

/**
 * Thin typed wrappers around the Phase 1 read endpoints. All requests go
 * through Vite's `/api` dev proxy to the Express server — the client never
 * talks to the server's port directly.
 */
export const api = {
  getWater: () => getJson<WaterSnapshot>('/api/water'),
  getSources: () => getJson<WaterSource[]>('/api/sources'),
  getZones: () => getJson<IrrigationZone[]>('/api/zones'),
  getSystem: () => getJson<SystemSnapshot>('/api/system'),
}
