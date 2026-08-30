import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Loads repo-root or server `.env` into `process.env` without overriding
 * values already set. Secrets stay on the server — never in the browser.
 */
function loadLocalEnvFile() {
  const here = dirname(fileURLToPath(import.meta.url))
  const candidates = [resolve(here, '../../.env'), resolve(here, '../.env')]
  for (const file of candidates) {
    if (!existsSync(file)) continue
    const text = readFileSync(file, 'utf8')
    for (const raw of text.split('\n')) {
      const line = raw.trim()
      if (!line || line.startsWith('#')) continue
      const eq = line.indexOf('=')
      if (eq <= 0) continue
      const key = line.slice(0, eq).trim()
      let value = line.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      // Skip blanks so an empty `.env` placeholder cannot block a later real key.
      if (!key || !value) continue
      if (process.env[key]) continue
      process.env[key] = value
    }
  }
}

loadLocalEnvFile()

/**
 * Centralized env var reads. `USE_SIMULATED` stays `true` for the whole
 * build until real ESP32 hardware integration is explicitly requested
 * (Phase 9) — nothing else in the codebase should read `process.env`
 * directly for this flag.
 */
export const USE_SIMULATED = (process.env.USE_SIMULATED ?? 'true') !== 'false'

export const PORT = Number(process.env.PORT ?? 5418)

/** Bind address. Render and other hosts need `0.0.0.0`, not localhost-only. */
export const HOST = process.env.HOST ?? '0.0.0.0'

/** Simulated minutes of farm time advanced per simulation tick. */
export const SIM_MINUTES_PER_TICK = Number(process.env.SIM_MINUTES_PER_TICK ?? 1)

/** Real milliseconds between simulation ticks. */
export const SIM_TICK_INTERVAL_MS = Number(process.env.SIM_TICK_INTERVAL_MS ?? 5000)

/** Real milliseconds between automatic irrigation decision cycles (Auto mode only). */
export const AUTO_IRRIGATION_INTERVAL_MS = Number(process.env.AUTO_IRRIGATION_INTERVAL_MS ?? 5000)

/**
 * Khaya ASR v3 subscription key — server only. Never send this to the browser,
 * never log it, never put it in API responses.
 */
export function getKhayaAsrApiKey(): string {
  loadLocalEnvFile()
  return (process.env.KHAYA_ASR_API_KEY ?? '').trim()
}

/**
 * Khaya TTS v2 subscription key — server only. Never send this to the browser,
 * never log it, never put it in API responses.
 */
export function getKhayaTtsApiKey(): string {
  loadLocalEnvFile()
  return (process.env.KHAYA_TTS_API_KEY ?? '').trim()
}

/**
 * Khaya ASR language code. Phase 8A listens in African English (`eng`).
 * Ghanaian-language switching is Phase 8C.
 */
export const KHAYA_ASR_LANGUAGE = process.env.KHAYA_ASR_LANGUAGE ?? 'eng'

/** Optional override of the Khaya ASR v3 transcribe URL. */
export const KHAYA_ASR_URL = process.env.KHAYA_ASR_URL ?? ''

/**
 * Khaya TTS language code. Phase 8B speaks African English (`eng`).
 * Ghanaian-language switching is Phase 8C.
 */
export const KHAYA_TTS_LANGUAGE = process.env.KHAYA_TTS_LANGUAGE ?? 'eng'

/** Optional override of the Khaya TTS v2 synthesize URL. */
export const KHAYA_TTS_URL = process.env.KHAYA_TTS_URL ?? ''

/** Optional Khaya voice: male_low, male_high, or female. Empty uses Khaya's default. */
export const KHAYA_TTS_SPEAKER = process.env.KHAYA_TTS_SPEAKER ?? ''

/**
 * Optional farm coordinates for the weather forecast. Not a secret.
 * When unset, AquaFlow uses the farm location in Settings (seeded as
 * Kumasi, Ghana). The Open-Meteo client reads whatever location is
 * configured — it does not bake in its own city.
 */
export function readFarmLocationFromEnv(): { latitude: number; longitude: number; label: string } | undefined {
  loadLocalEnvFile()
  const latitude = Number(process.env.FARM_LATITUDE)
  const longitude = Number(process.env.FARM_LONGITUDE)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return undefined
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return undefined
  const label = (process.env.FARM_LOCATION_LABEL ?? '').trim()
  return { latitude, longitude, label: label || 'Farm location' }
}
