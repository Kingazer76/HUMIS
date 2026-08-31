/**
 * Khaya speech layer helpers shared by the server (ears/mouth) and the
 * Assistant UI. Farm answers still come from HUMIS — this file only
 * covers language codes and farmer-facing voice wording.
 *
 * Codes were checked against the live Khaya catalogs:
 * GET /asr/v3/languages, GET /tts/v2/languages, GET /v2/languages.
 * Only languages present there are marked active.
 */

export const DEFAULT_KHAYA_LANGUAGE = 'eng'
export const DEFAULT_ASSISTANT_LANGUAGE = 'eng'
export const ASSISTANT_LANGUAGE_STORAGE_KEY = 'humis_language'

export type AssistantLanguageId = 'eng' | 'twi' | 'atw' | 'gaa' | 'ewe' | 'fat'

export type AssistantLanguageConfig = {
  id: AssistantLanguageId
  /** Farmer-facing name. No API codes. */
  label: string
  asrCode: string
  ttsCode: string
  /**
   * Khaya translation v2 language id used in `eng-{code}` / `{code}-eng` pairs.
   * Null means the farm brain already works in this language (English).
   * Akuapem Twi has ASR/TTS (`atw`) but no translation pair, so it uses Twi (`twi`).
   */
  translateCode: string | null
  asrSupported: boolean
  ttsSupported: boolean
  active: boolean
}

/**
 * Languages HUMIS is willing to send to Khaya.
 * `active: true` means the Assistant selector may offer it.
 */
export const KHAYA_LANGUAGE_CATALOG: Record<AssistantLanguageId, AssistantLanguageConfig> = {
  eng: {
    id: 'eng',
    label: 'English',
    asrCode: 'eng',
    ttsCode: 'eng',
    translateCode: null,
    asrSupported: true,
    ttsSupported: true,
    active: true,
  },
  twi: {
    id: 'twi',
    label: 'Asante Twi',
    asrCode: 'twi',
    ttsCode: 'twi',
    translateCode: 'twi',
    asrSupported: true,
    ttsSupported: true,
    active: true,
  },
  atw: {
    id: 'atw',
    label: 'Akuapem Twi',
    asrCode: 'atw',
    ttsCode: 'atw',
    translateCode: 'twi',
    asrSupported: true,
    ttsSupported: true,
    active: true,
  },
  gaa: {
    id: 'gaa',
    label: 'Ga',
    asrCode: 'gaa',
    ttsCode: 'gaa',
    translateCode: 'gaa',
    asrSupported: true,
    ttsSupported: true,
    active: true,
  },
  ewe: {
    id: 'ewe',
    label: 'Ewe',
    asrCode: 'ewe',
    ttsCode: 'ewe',
    translateCode: 'ewe',
    asrSupported: true,
    ttsSupported: true,
    active: true,
  },
  fat: {
    id: 'fat',
    label: 'Fante',
    asrCode: 'fat',
    ttsCode: 'fat',
    translateCode: 'fat',
    asrSupported: true,
    ttsSupported: true,
    active: true,
  },
}

export type KhayaLanguageCode = AssistantLanguageId

export const ASSISTANT_LANGUAGE_OPTIONS: AssistantLanguageId[] = ['eng', 'twi', 'atw', 'gaa', 'ewe', 'fat']

export function isRegisteredKhayaLanguage(code: string): code is KhayaLanguageCode {
  return Object.prototype.hasOwnProperty.call(KHAYA_LANGUAGE_CATALOG, code)
}

export function isAssistantLanguageId(code: string | undefined): code is AssistantLanguageId {
  return typeof code === 'string' && isRegisteredKhayaLanguage(code) && KHAYA_LANGUAGE_CATALOG[code].active
}

/**
 * Picks a Khaya language code for an ASR/TTS request.
 * Empty or missing values fall back to African English.
 * Unknown codes are passed through so a later language can be tried from
 * the server env without rewriting the Assistant.
 */
export function resolveKhayaLanguage(code?: string): string {
  const trimmed = (code ?? '').trim()
  return trimmed || DEFAULT_KHAYA_LANGUAGE
}

/** Selector / request language. Unknown values become English. */
export function resolveAssistantLanguage(code?: string): AssistantLanguageId {
  const trimmed = (code ?? '').trim()
  if (isAssistantLanguageId(trimmed)) return trimmed
  return DEFAULT_ASSISTANT_LANGUAGE
}

export function assistantLanguageConfig(code?: string): AssistantLanguageConfig {
  return KHAYA_LANGUAGE_CATALOG[resolveAssistantLanguage(code)]
}

export function activeKhayaLanguage(): KhayaLanguageCode {
  return DEFAULT_KHAYA_LANGUAGE
}

export function activeAssistantLanguages(): AssistantLanguageConfig[] {
  return ASSISTANT_LANGUAGE_OPTIONS.map((id) => KHAYA_LANGUAGE_CATALOG[id]).filter((item) => item.active)
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
  couldNotUnderstandLanguage: "I couldn't understand that. Please try again or switch language.",
  didntCatch: "I didn't quite catch that. Please try again.",
  misheard: 'I may have misheard you.',
  cancelled: 'Okay. I will not do that.',
  noInternet: 'Please check your internet connection.',
  generic: 'Something went wrong. Please try again.',
  micDenied: 'Microphone is blocked. Allow the microphone and try again.',
  micMissing: 'No microphone found. Type your question instead.',
  micUnsupported: 'This browser cannot use the microphone. Type your question instead.',
  speakFailed: "Couldn't speak that. The written answer is still on screen.",
  voiceUnavailableForLanguage: 'Voice response is not available for this language yet. Here is the answer in text.',
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
