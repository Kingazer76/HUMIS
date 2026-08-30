import { describe, expect, it } from 'vitest'
import { VOICE_MESSAGES, toFarmerVoiceMessage } from '@aquaflow/shared'
import { encodeWav, MIN_WAV_BYTES, wavBlobIsTooShort } from './recordSpeech'
import {
  isNetworkFailure,
  microphoneErrorMessage,
  speakErrorMessage,
  voiceStatusLabel,
} from './voiceErrors'

describe('voice status labels', () => {
  it('shows Listening, Understanding, Thinking, then Speaking in order', () => {
    expect(voiceStatusLabel({ listening: true, understanding: false, pending: false, speaking: false })).toBe(
      VOICE_MESSAGES.listening,
    )
    expect(voiceStatusLabel({ listening: false, understanding: true, pending: false, speaking: false })).toBe(
      VOICE_MESSAGES.understanding,
    )
    expect(voiceStatusLabel({ listening: false, understanding: false, pending: true, speaking: false })).toBe(
      VOICE_MESSAGES.thinking,
    )
    expect(voiceStatusLabel({ listening: false, understanding: false, pending: false, speaking: true })).toBe(
      VOICE_MESSAGES.speaking,
    )
    expect(voiceStatusLabel({ listening: false, understanding: false, pending: false, speaking: false })).toBeUndefined()
  })
})

describe('farmer voice errors', () => {
  it('maps microphone problems without technical wording', () => {
    expect(microphoneErrorMessage(Object.assign(new Error('denied'), { name: 'NotAllowedError' }))).toBe(
      VOICE_MESSAGES.micDenied,
    )
    expect(microphoneErrorMessage(Object.assign(new Error('missing'), { name: 'NotFoundError' }))).toBe(
      VOICE_MESSAGES.micMissing,
    )
    expect(microphoneErrorMessage(new Error('nope'))).toBe(VOICE_MESSAGES.micUnsupported)
  })

  it('maps speak failures and hides API wording', () => {
    expect(speakErrorMessage(new TypeError('Failed to fetch'))).toBe(VOICE_MESSAGES.noInternet)
    expect(speakErrorMessage(new Error('TTS endpoint unavailable'))).toBe(VOICE_MESSAGES.speakFailed)
    expect(speakErrorMessage(new Error('HTTP 500'))).toBe(VOICE_MESSAGES.speakFailed)
    expect(isNetworkFailure(new TypeError('Failed to fetch'))).toBe(true)
    expect(isNetworkFailure(Object.assign(new Error('aborted'), { name: 'AbortError' }))).toBe(false)
  })

  it('keeps simple farmer sentences', () => {
    expect(toFarmerVoiceMessage(VOICE_MESSAGES.couldNotUnderstand, VOICE_MESSAGES.generic)).toBe(
      VOICE_MESSAGES.couldNotUnderstand,
    )
  })
})

describe('speech recording size', () => {
  it('treats a near-empty WAV as too short to send', () => {
    const empty = encodeWav(new Float32Array(10), 16000)
    expect(empty.type).toBe('audio/wav')
    expect(wavBlobIsTooShort(empty)).toBe(true)
    const longEnough = encodeWav(new Float32Array(MIN_WAV_BYTES), 16000)
    expect(wavBlobIsTooShort(longEnough)).toBe(false)
  })
})
