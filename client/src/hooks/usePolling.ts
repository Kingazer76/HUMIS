import { useEffect, useRef, useState } from 'react'
import { useTabActive } from '@/hooks/tabActivity'
import {
  isSharedFetchFresh,
  loadSharedFetch,
  readSharedFetch,
} from '@/lib/sharedFetch'

interface PollingResult<T> {
  data: T | undefined
  error: Error | undefined
  isLoading: boolean
  /** Fetches immediately, outside the regular interval — used right after a mutation so the UI doesn't wait up to `intervalMs` to reflect it. */
  refetch: () => Promise<void>
}

/**
 * Polls `fetcher` every `intervalMs` and returns its latest result. Used
 * instead of a real-time push channel to match V1's simple, non-charted,
 * periodically-refreshed feel.
 *
 * Last successful values are shared across tabs, and polling pauses while
 * a tab is hidden, so switching tabs does not blank the screen or refetch
 * data that is already fresh.
 */
export function usePolling<T>(fetcher: () => Promise<T>, intervalMs = 5000): PollingResult<T> {
  const active = useTabActive()
  const cached = readSharedFetch(fetcher)
  const [data, setData] = useState<T | undefined>(cached.data)
  const [error, setError] = useState<Error | undefined>(cached.error)
  const [isLoading, setIsLoading] = useState(cached.data === undefined && cached.error === undefined)
  const fetcherRef = useRef(fetcher)

  useEffect(() => {
    fetcherRef.current = fetcher
  }, [fetcher])

  const apply = useRef((next: { data: T | undefined; error: Error | undefined }) => {
    setData(next.data)
    setError(next.error)
    setIsLoading(false)
  })

  const run = useRef(async () => {
    const snapshot = await loadSharedFetch(fetcherRef.current)
    apply.current({ data: snapshot.data, error: snapshot.error })
  })

  useEffect(() => {
    if (!active) return

    let cancelled = false
    const tick = async () => {
      if (!cancelled) await run.current()
    }

    const current = readSharedFetch(fetcherRef.current)
    if (current.data !== undefined || current.error !== undefined) {
      apply.current({ data: current.data, error: current.error })
    }

    if (!isSharedFetchFresh(fetcherRef.current, intervalMs)) {
      void tick()
    }

    const id = setInterval(tick, intervalMs)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [active, intervalMs])

  return { data, error, isLoading, refetch: () => run.current() }
}
