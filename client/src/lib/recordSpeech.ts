import { VOICE_MESSAGES } from '@aquaflow/shared'

const TARGET_RATE = 16000
const MAX_MS = 12_000
/** Keep the last syllable after you release — "pump" was getting cut to "comb". */
const TRAILING_CAPTURE_MS = 220
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

/**
 * Average the samples that land in each output bin.
 * Nearest-neighbour picking was throwing away most of the waveform and
 * made short farm words like "pump" easier for Khaya to mishear.
 */
export function downsampleAverage(input: Float32Array, inputRate: number, outputRate: number): Float32Array {
  if (inputRate === outputRate || input.length === 0) return input
  if (outputRate > inputRate) {
    const ratio = outputRate / inputRate
    const output = new Float32Array(Math.round(input.length * ratio))
    for (let i = 0; i < output.length; i += 1) {
      const src = i / ratio
      const left = Math.floor(src)
      const right = Math.min(left + 1, input.length - 1)
      const t = src - left
      output[i] = (input[left] ?? 0) * (1 - t) + (input[right] ?? 0) * t
    }
    return output
  }

  const ratio = inputRate / outputRate
  const outLength = Math.max(1, Math.round(input.length / ratio))
  const output = new Float32Array(outLength)
  for (let i = 0; i < outLength; i += 1) {
    const start = Math.floor(i * ratio)
    const end = Math.min(Math.floor((i + 1) * ratio), input.length)
    let sum = 0
    const count = Math.max(1, end - start)
    for (let j = start; j < end; j += 1) {
      sum += input[j] ?? 0
    }
    output[i] = sum / count
  }
  return output
}

/** Raise quiet speech a little. Leave near-silence alone so noise is not invented. */
export function normalizeSpeech(samples: Float32Array, targetPeak = 0.89): Float32Array {
  let peak = 0
  for (let i = 0; i < samples.length; i += 1) {
    const value = Math.abs(samples[i] ?? 0)
    if (value > peak) peak = value
  }
  if (peak < 0.03 || peak >= targetPeak) {
    return samples
  }
  const gain = targetPeak / peak
  const output = new Float32Array(samples.length)
  for (let i = 0; i < samples.length; i += 1) {
    output[i] = Math.max(-1, Math.min(1, (samples[i] ?? 0) * gain))
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

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

async function openMicrophone(): Promise<MediaStream> {
  const preferred: MediaStreamConstraints = {
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  }
  try {
    return await navigator.mediaDevices.getUserMedia(preferred)
  } catch {
    return await navigator.mediaDevices.getUserMedia({ audio: true })
  }
}

/**
 * Records microphone audio as 16 kHz mono WAV for Khaya ASR v3.
 * Hold to speak: start on press, stop on release. After 12 seconds it
 * stops on its own so the Assistant cannot stay stuck on "Listening".
 * Voice level is written to a CSS variable so the plant can move
 * without React re-rendering every frame.
 *
 * After release we keep ~220 ms more audio so the last word is not cut.
 */
export async function startSpeechRecording(options?: {
  onAutoStop?: () => void
  levelElement?: HTMLElement | null
}): Promise<SpeechRecorder> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error(VOICE_MESSAGES.micUnsupported)
  }

  const stream = await openMicrophone()
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
    finished = (async () => {
      await wait(TRAILING_CAPTURE_MS)
      window.cancelAnimationFrame(rafId)
      writeLevel(0)
      processor.disconnect()
      analyser.disconnect()
      source.disconnect()
      mute.disconnect()
      stream.getTracks().forEach((track) => track.stop())
      await context.close()
      const merged = mergeFloat32(chunks)
      const sampled = downsampleAverage(merged, inputRate, TARGET_RATE)
      const normalized = normalizeSpeech(sampled)
      return encodeWav(normalized, TARGET_RATE)
    })()
    return finished
  }

  timeoutId = window.setTimeout(() => {
    if (stopped) return
    void stop().then(() => options?.onAutoStop?.())
  }, MAX_MS)

  return { stop }
}
