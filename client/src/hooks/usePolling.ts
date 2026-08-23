import { useEffect, useRef, useState } from 'react'

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
 */
export function usePolling<T>(fetcher: () => Promise<T>, intervalMs = 5000): PollingResult<T> {
  const [data, setData] = useState<T | undefined>(undefined)
  const [error, setError] = useState<Error | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(true)
  const fetcherRef = useRef(fetcher)

  useEffect(() => {
    fetcherRef.current = fetcher
  }, [fetcher])

  const run = useRef(async () => {
    try {
      const result = await fetcherRef.current()
      setData(result)
      setError(undefined)
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setIsLoading(false)
    }
  })

  useEffect(() => {
    let cancelled = false
    const tick = async () => {
      if (!cancelled) await run.current()
    }
    tick()
    const id = setInterval(tick, intervalMs)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [intervalMs])

  return { data, error, isLoading, refetch: () => run.current() }
}
