import { describe, expect, it } from 'vitest'
import { downsampleAverage, encodeWav, MIN_WAV_BYTES, normalizeSpeech, wavBlobIsTooShort } from './recordSpeech'

describe('speech recording helpers', () => {
  it('treats a near-empty WAV as too short to send', () => {
    const empty = encodeWav(new Float32Array(10), 16000)
    expect(empty.type).toBe('audio/wav')
    expect(wavBlobIsTooShort(empty)).toBe(true)
    const longEnough = encodeWav(new Float32Array(MIN_WAV_BYTES), 16000)
    expect(wavBlobIsTooShort(longEnough)).toBe(false)
  })

  it('averages samples when shrinking the recording instead of picking one neighbour', () => {
    const input = new Float32Array([0, 1, 0, 1, 0, 1, 0, 1])
    const down = downsampleAverage(input, 8, 2)
    expect(down.length).toBe(2)
    expect(down[0]).toBeCloseTo(0.5)
    expect(down[1]).toBeCloseTo(0.5)
  })

  it('raises quiet speech but leaves near-silence alone', () => {
    const quiet = new Float32Array([0.04, -0.05, 0.03])
    const louder = normalizeSpeech(quiet)
    expect(Math.max(...Array.from(louder).map(Math.abs))).toBeGreaterThan(0.8)

    const hush = new Float32Array([0.001, -0.002, 0])
    expect(normalizeSpeech(hush)).toBe(hush)
  })
})
