export type SpeechPlayback = {
  play: (blob: Blob) => Promise<void>
  stop: () => void
}

/**
 * Plays assistant speech in the browser. Stop cancels playback without
 * touching the written answer. A watchdog clears "Speaking" if audio
 * never finishes.
 */
export function createSpeechPlayback(): SpeechPlayback {
  let audio: HTMLAudioElement | null = null
  let objectUrl: string | null = null
  let watchdog = 0

  function stop() {
    window.clearTimeout(watchdog)
    watchdog = 0
    if (audio) {
      audio.onended = null
      audio.onerror = null
      audio.onloadedmetadata = null
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
      audio = null
    }
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl)
      objectUrl = null
    }
  }

  function play(blob: Blob): Promise<void> {
    stop()
    objectUrl = URL.createObjectURL(blob)
    const current = new Audio(objectUrl)
    audio = current
    return new Promise((resolve, reject) => {
      let settled = false

      function finish(error?: unknown) {
        if (settled) return
        settled = true
        stop()
        if (error) {
          reject(error instanceof Error ? error : new Error('Could not play audio'))
          return
        }
        resolve()
      }

      function armWatchdog(ms: number) {
        window.clearTimeout(watchdog)
        watchdog = window.setTimeout(() => finish(new Error('Could not play audio')), ms)
      }

      armWatchdog(8_000)
      current.onloadedmetadata = () => {
        const seconds = current.duration
        const ms =
          Number.isFinite(seconds) && seconds > 0 ? Math.min(120_000, (seconds + 2) * 1000) : 30_000
        armWatchdog(ms)
      }
      current.onended = () => finish()
      current.onerror = () => finish(new Error('Could not play audio'))
      void current.play().catch((error: unknown) => finish(error))
    })
  }

  return { play, stop }
}
