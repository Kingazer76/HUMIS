import { toFarmerVoiceMessage, VOICE_MESSAGES } from '@aquaflow/shared'

export function isNetworkFailure(err: unknown): boolean {
  if (err instanceof TypeError) return true
  if (!(err instanceof Error)) return false
  if (err.name === 'AbortError') return false
  return /failed to fetch|networkerror|load failed|network request failed/i.test(err.message)
}

export function microphoneErrorMessage(err: unknown): string {
  if (err instanceof DOMException || err instanceof Error) {
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      return VOICE_MESSAGES.micDenied
    }
    if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      return VOICE_MESSAGES.micMissing
    }
  }
  return VOICE_MESSAGES.micUnsupported
}

export function speakErrorMessage(err: unknown): string {
  if (isNetworkFailure(err)) return VOICE_MESSAGES.noInternet
  const message = err instanceof Error ? err.message : undefined
  return toFarmerVoiceMessage(message, VOICE_MESSAGES.speakFailed)
}

export function voiceStatusLabel(phase: {
  listening: boolean
  understanding: boolean
  pending: boolean
  speaking: boolean
}): string | undefined {
  if (phase.listening) return VOICE_MESSAGES.listening
  if (phase.understanding) return VOICE_MESSAGES.understanding
  if (phase.pending) return VOICE_MESSAGES.thinking
  if (phase.speaking) return VOICE_MESSAGES.speaking
  return undefined
}
