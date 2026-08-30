import { VOICE_MESSAGES } from '@aquaflow/shared'

const TARGET_RATE = 16000
const MAX_MS = 12_000
/** WAV header plus about one third of a second of 16 kHz 16-bit audio. */
export const MIN_WAV_BYTES = 44 + Math.floor(TARGET_RATE * 0.35) * 2

export function wavBlobIsTooShort(blob: Blob): boolean {
  return blob.size < MIN_WAV_BYTES
}

function mergeFloat32(chunks: Float32Array[]): Float32Array {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const merged = new Float32Array(length)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.length
  }
  return merged
}

function downsample(input: Float32Array, inputRate: number, outputRate: number): Float32Array {
  if (inputRate === outputRate) return input
  const ratio = inputRate / outputRate
  const outLength = Math.max(1, Math.round(input.length / ratio))
  const output = new Float32Array(outLength)
  for (let i = 0; i < outLength; i += 1) {
    const start = Math.round(i * ratio)
    output[i] = input[Math.min(start, input.length - 1)] ?? 0
  }
  return output
}

export function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const bytesPerSample = 2
  const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample)
  const view = new DataView(buffer)

  function writeString(offset: number, value: string) {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i))
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * bytesPerSample, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * bytesPerSample, true)
  view.setUint16(32, bytesPerSample, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, samples.length * bytesPerSample, true)

  let offset = 44
  for (let i = 0; i < samples.length; i += 1) {
    const s = Math.max(-1, Math.min(1, samples[i] ?? 0))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    offset += 2
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

export interface SpeechRecorder {
  stop: () => Promise<Blob>
}

/**
 * Records microphone audio as 16 kHz WAV for Khaya ASR.
 * Hold to speak: start on press, stop on release. After 12 seconds it
 * stops on its own so the Assistant cannot stay stuck on "Listening".
 * Voice level is written to a CSS variable so the plant can move
 * without React re-rendering every frame.
 */
export async function startSpeechRecording(options?: {
  onAutoStop?: () => void
  levelElement?: HTMLElement | null
}): Promise<SpeechRecorder> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error(VOICE_MESSAGES.micUnsupported)
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const context = new AudioContext()
  if (context.state === 'suspended') await context.resume()
  const source = context.createMediaStreamSource(stream)
  const processor = context.createScriptProcessor(4096, 1, 1)
  const analyser = context.createAnalyser()
  analyser.fftSize = 256
  const mute = context.createGain()
  mute.gain.value = 0

  const chunks: Float32Array[] = []
  processor.onaudioprocess = (event) => {
    chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)))
  }

  source.connect(analyser)
  source.connect(processor)
  processor.connect(mute)
  mute.connect(context.destination)

  const inputRate = context.sampleRate || TARGET_RATE
  let finished: Promise<Blob> | undefined
  let stopped = false
  let timeoutId = 0
  let rafId = 0
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const levelEl = options?.levelElement
  const samples = new Uint8Array(analyser.fftSize)
  let smoothed = 0

  function writeLevel(value: number) {
    levelEl?.style.setProperty('--voice-level', value.toFixed(3))
  }

  function watchLevel() {
    analyser.getByteTimeDomainData(samples)
    let sum = 0
    for (const value of samples) {
      const n = (value - 128) / 128
      sum += n * n
    }
    const rms = Math.sqrt(sum / samples.length)
    const level = Math.min(1, rms * 3.4)
    smoothed = smoothed * 0.84 + level * 0.16
    writeLevel(smoothed)
    rafId = window.requestAnimationFrame(watchLevel)
  }

  if (levelEl && !reduceMotion) {
    rafId = window.requestAnimationFrame(watchLevel)
  }

  async function stop() {
    if (finished) return finished
    stopped = true
    window.clearTimeout(timeoutId)
    window.cancelAnimationFrame(rafId)
    writeLevel(0)
    finished = (async () => {
      processor.disconnect()
      analyser.disconnect()
      source.disconnect()
      mute.disconnect()
      stream.getTracks().forEach((track) => track.stop())
      await context.close()
      const merged = mergeFloat32(chunks)
      const sampled = downsample(merged, inputRate, TARGET_RATE)
      return encodeWav(sampled, TARGET_RATE)
    })()
    return finished
  }

  timeoutId = window.setTimeout(() => {
    if (stopped) return
    void stop().then(() => options?.onAutoStop?.())
  }, MAX_MS)

  return { stop }
}
