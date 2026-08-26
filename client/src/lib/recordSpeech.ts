const TARGET_RATE = 16000
const MAX_MS = 12_000

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

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
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
 * Records microphone audio as 16 kHz WAV for Azure Speech.
 * Hold-to-talk is not required: tap to start, tap again to stop.
 */
export async function startSpeechRecording(): Promise<SpeechRecorder> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('This browser cannot use the microphone.')
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const context = new AudioContext()
  if (context.state === 'suspended') await context.resume()
  const source = context.createMediaStreamSource(stream)
  const processor = context.createScriptProcessor(4096, 1, 1)
  const mute = context.createGain()
  mute.gain.value = 0

  const chunks: Float32Array[] = []
  processor.onaudioprocess = (event) => {
    chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)))
  }

  source.connect(processor)
  processor.connect(mute)
  mute.connect(context.destination)

  const inputRate = context.sampleRate || TARGET_RATE
  let finished: Promise<Blob> | undefined
  let stopped = false

  async function stop() {
    if (finished) return finished
    stopped = true
    finished = (async () => {
      processor.disconnect()
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

  window.setTimeout(() => {
    if (!stopped) void stop()
  }, MAX_MS)

  return { stop }
}
