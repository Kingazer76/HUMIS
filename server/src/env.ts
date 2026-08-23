/**
 * Centralized env var reads. `USE_SIMULATED` stays `true` for the whole
 * build until real ESP32 hardware integration is explicitly requested
 * (Phase 7) — nothing else in the codebase should read `process.env`
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
