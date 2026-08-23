import { useEffect, useRef, useState } from 'react'

interface PollingResult<T> {
  data: T | undefined
  error: Error | undefined
  isLoading: boolean
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

  useEffect(() => {
    let cancelled = false

    async function run() {
      try {
        const result = await fetcherRef.current()
        if (!cancelled) {
          setData(result)
          setError(undefined)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)))
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    run()
    const id = setInterval(run, intervalMs)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [intervalMs])

  return { data, error, isLoading }
}
