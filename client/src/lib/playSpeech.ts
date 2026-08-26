export type SpeechPlayback = {
  play: (blob: Blob) => Promise<void>
  stop: () => void
}

/**
 * Plays assistant speech in the browser. Stop cancels playback without
 * touching the written answer.
 */
export function createSpeechPlayback(): SpeechPlayback {
  let audio: HTMLAudioElement | null = null
  let objectUrl: string | null = null

  function stop() {
    if (audio) {
      audio.onended = null
      audio.onerror = null
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
      current.onended = () => {
        stop()
        resolve()
      }
      current.onerror = () => {
        stop()
        reject(new Error('Could not play audio'))
      }
      void current.play().catch((error: unknown) => {
        stop()
        reject(error)
      })
    })
  }

  return { play, stop }
}
