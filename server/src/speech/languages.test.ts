import { describe, expect, it } from 'vitest'
import {
  KHAYA_LANGUAGE_CATALOG,
  DEFAULT_KHAYA_LANGUAGE,
  activeKhayaLanguage,
  isRegisteredKhayaLanguage,
  resolveKhayaLanguage,
  toFarmerVoiceMessage,
  VOICE_MESSAGES,
} from '@aquaflow/shared'

describe('Khaya language catalog', () => {
  it('only treats African English as active', () => {
    expect(DEFAULT_KHAYA_LANGUAGE).toBe('eng')
    expect(activeKhayaLanguage()).toBe('eng')
    expect(KHAYA_LANGUAGE_CATALOG.eng.active).toBe(true)
    expect(KHAYA_LANGUAGE_CATALOG.eng.asrSupported).toBe(true)
    expect(KHAYA_LANGUAGE_CATALOG.eng.ttsSupported).toBe(true)
    expect(Object.keys(KHAYA_LANGUAGE_CATALOG)).toEqual(['eng'])
    expect(isRegisteredKhayaLanguage('twi')).toBe(false)
    expect(isRegisteredKhayaLanguage('ga')).toBe(false)
    expect(isRegisteredKhayaLanguage('ewe')).toBe(false)
  })

  it('falls back to African English and can pass a later code without rewriting chat', () => {
    expect(resolveKhayaLanguage(undefined)).toBe('eng')
    expect(resolveKhayaLanguage('')).toBe('eng')
    expect(resolveKhayaLanguage('  ')).toBe('eng')
    expect(resolveKhayaLanguage('eng')).toBe('eng')
    expect(resolveKhayaLanguage('twi')).toBe('twi')
  })
})

describe('farmer voice messages', () => {
  it('hides technical API wording from the farmer', () => {
    expect(toFarmerVoiceMessage('ASR failed', VOICE_MESSAGES.generic)).toBe(VOICE_MESSAGES.generic)
    expect(toFarmerVoiceMessage('TTS endpoint unavailable', VOICE_MESSAGES.speakFailed)).toBe(
      VOICE_MESSAGES.speakFailed,
    )
    expect(toFarmerVoiceMessage('HTTP 500', VOICE_MESSAGES.generic)).toBe(VOICE_MESSAGES.generic)
    expect(toFarmerVoiceMessage('Khaya API error', VOICE_MESSAGES.generic)).toBe(VOICE_MESSAGES.generic)
    expect(toFarmerVoiceMessage('Add KHAYA_API_KEY', VOICE_MESSAGES.voiceNotReady)).toBe(
      VOICE_MESSAGES.voiceNotReady,
    )
    expect(toFarmerVoiceMessage(VOICE_MESSAGES.couldNotHear, VOICE_MESSAGES.generic)).toBe(
      VOICE_MESSAGES.couldNotHear,
    )
  })
})
