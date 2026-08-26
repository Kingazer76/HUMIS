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
      const value = line.slice(eq + 1).trim()
      if (process.env[key] === undefined) process.env[key] = value
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

/** Simulated minutes of farm time advanced per simulation tick. */
export const SIM_MINUTES_PER_TICK = Number(process.env.SIM_MINUTES_PER_TICK ?? 1)

/** Real milliseconds between simulation ticks. */
export const SIM_TICK_INTERVAL_MS = Number(process.env.SIM_TICK_INTERVAL_MS ?? 5000)

/** Real milliseconds between automatic irrigation decision cycles (Auto mode only). */
export const AUTO_IRRIGATION_INTERVAL_MS = Number(process.env.AUTO_IRRIGATION_INTERVAL_MS ?? 5000)

/** Khaya AI API key — server only. Never send this to the browser. */
export const KHAYA_API_KEY = process.env.KHAYA_API_KEY ?? ''

/**
 * Khaya ASR language code. Phase 8A listens in African English (`eng`).
 * Ghanaian-language switching is Phase 8C.
 */
export const KHAYA_ASR_LANGUAGE = process.env.KHAYA_ASR_LANGUAGE ?? 'eng'

/** Optional override of the Khaya ASR v3 transcribe URL. */
export const KHAYA_ASR_URL = process.env.KHAYA_ASR_URL ?? ''
