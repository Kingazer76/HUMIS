import { describe, expect, it } from 'vitest'
import {
  ASSISTANT_LANGUAGE_OPTIONS,
  DEFAULT_ASSISTANT_LANGUAGE,
  DEFAULT_KHAYA_LANGUAGE,
  KHAYA_LANGUAGE_CATALOG,
  activeAssistantLanguages,
  activeKhayaLanguage,
  assistantLanguageConfig,
  isRegisteredKhayaLanguage,
  resolveAssistantLanguage,
  resolveKhayaLanguage,
  toFarmerVoiceMessage,
  VOICE_MESSAGES,
} from '@aquaflow/shared'

describe('Khaya language catalog', () => {
  it('defaults to African English and keeps it as the safe fallback', () => {
    expect(DEFAULT_KHAYA_LANGUAGE).toBe('eng')
    expect(DEFAULT_ASSISTANT_LANGUAGE).toBe('eng')
    expect(activeKhayaLanguage()).toBe('eng')
    expect(KHAYA_LANGUAGE_CATALOG.eng.active).toBe(true)
    expect(KHAYA_LANGUAGE_CATALOG.eng.asrSupported).toBe(true)
    expect(KHAYA_LANGUAGE_CATALOG.eng.ttsSupported).toBe(true)
    expect(resolveAssistantLanguage(undefined)).toBe('eng')
    expect(resolveAssistantLanguage('nope')).toBe('eng')
  })

  it('only offers languages confirmed on the live Khaya ASR, TTS, and translation catalogs', () => {
    expect(ASSISTANT_LANGUAGE_OPTIONS).toEqual(['eng', 'twi', 'atw', 'gaa', 'ewe', 'fat'])
    expect(activeAssistantLanguages().map((item) => item.label)).toEqual([
      'English',
      'Asante Twi',
      'Akuapem Twi',
      'Ga',
      'Ewe',
      'Fante',
    ])
    expect(assistantLanguageConfig('twi')).toMatchObject({ asrCode: 'twi', ttsCode: 'twi', translateCode: 'twi' })
    expect(assistantLanguageConfig('atw')).toMatchObject({ asrCode: 'atw', ttsCode: 'atw', translateCode: 'twi' })
    expect(assistantLanguageConfig('gaa')).toMatchObject({ asrCode: 'gaa', ttsCode: 'gaa', translateCode: 'gaa' })
    expect(assistantLanguageConfig('ewe')).toMatchObject({ asrCode: 'ewe', ttsCode: 'ewe', translateCode: 'ewe' })
    expect(assistantLanguageConfig('fat')).toMatchObject({ asrCode: 'fat', ttsCode: 'fat', translateCode: 'fat' })
    expect(isRegisteredKhayaLanguage('twi')).toBe(true)
    expect(isRegisteredKhayaLanguage('ga')).toBe(false)
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
