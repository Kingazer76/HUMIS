/**
 * Khaya speech layer helpers shared by the server (ears/mouth) and the
 * Assistant UI. Farm answers still come from AquaFlow — this file only
 * covers language codes and farmer-facing voice wording.
 *
 * Ghanaian-language switching is not enabled yet. Only African English
 * (`eng`) is registered as active. Add a language here later without
 * rewriting the Assistant.
 */

export const DEFAULT_KHAYA_LANGUAGE = 'eng'

/**
 * Languages AquaFlow is willing to send to Khaya.
 * `active: true` means the live Assistant uses it today.
 * Do not mark Twi, Ga, Ewe, or others active until they are actually wired.
 */
export const KHAYA_LANGUAGE_CATALOG = {
  eng: {
    code: 'eng',
    label: 'African English',
    asrSupported: true,
    ttsSupported: true,
    active: true,
  },
} as const

export type KhayaLanguageCode = keyof typeof KHAYA_LANGUAGE_CATALOG

export function isRegisteredKhayaLanguage(code: string): code is KhayaLanguageCode {
  return Object.prototype.hasOwnProperty.call(KHAYA_LANGUAGE_CATALOG, code)
}

/**
 * Picks a Khaya language code.
 * Empty or missing values fall back to African English.
 * Unknown codes are passed through so a later language can be tried from
 * the server env without rewriting the Assistant — they are not treated
 * as supported in the UI until added to the catalog.
 */
export function resolveKhayaLanguage(code?: string): string {
  const trimmed = (code ?? '').trim()
  return trimmed || DEFAULT_KHAYA_LANGUAGE
}

export function activeKhayaLanguage(): KhayaLanguageCode {
  return DEFAULT_KHAYA_LANGUAGE
}

/** Farmer-facing voice copy. Never include API, HTTP, or key details. */
export const VOICE_MESSAGES = {
  holdToSpeak: 'Hold to speak',
  tapToSpeak: 'Hold to speak',
  listening: 'Listening...',
  understanding: 'Thinking...',
  thinking: 'Thinking...',
  speaking: 'Speaking...',
  ready: 'Ready',
  couldNotHear: "Sorry, I couldn't hear you.",
  couldNotUnderstand: "Sorry, I couldn't understand that. Please try again.",
  didntCatch: "I didn't quite catch that. Please try again.",
  misheard: 'I may have misheard you.',
  cancelled: 'Okay. I will not do that.',
  noInternet: 'Please check your internet connection.',
  generic: 'Something went wrong. Please try again.',
  micDenied: 'Microphone is blocked. Allow the microphone and try again.',
  micMissing: 'No microphone found. Type your question instead.',
  micUnsupported: 'This browser cannot use the microphone. Type your question instead.',
  speakFailed: "Couldn't speak that. The written answer is still on screen.",
  voiceNotReady: 'Voice listening is not ready yet. Please type your question.',
  chatUnreachable: "Can't reach the AquaFlow server. Try again.",
} as const

const TECHNICAL_VOICE_ERROR =
  /khaya|api key|asr|tts|http\s*\d|endpoint|subscription|oauth|json|wav|mpeg|status\s*\d|validation_failed|system_error/i

/**
 * Keeps only farmer-friendly wording. Technical server details are
 * replaced with a simple retry message.
 */
export function toFarmerVoiceMessage(reason: string | undefined, fallback: string): string {
  const text = reason?.trim()
  if (!text) return fallback
  if (TECHNICAL_VOICE_ERROR.test(text)) return fallback
  return text
}
