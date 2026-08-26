/**
 * Shared in-flight + last-success cache keyed by the fetcher function.
 * Overview, Water, Irrigation, and Planning all call the same `api.getWater`
 * (and similar) helpers — this lets a newly opened tab show numbers that
 * another tab already loaded, instead of starting from a blank skeleton.
 */

interface CacheEntry<T> {
  data: T | undefined
  error: Error | undefined
  updatedAt: number
  inflight: Promise<void> | undefined
}

const cache = new Map<() => Promise<unknown>, CacheEntry<unknown>>()

function entryFor<T>(fetcher: () => Promise<T>): CacheEntry<T> {
  const key = fetcher as () => Promise<unknown>
  let entry = cache.get(key) as CacheEntry<T> | undefined
  if (!entry) {
    entry = { data: undefined, error: undefined, updatedAt: 0, inflight: undefined }
    cache.set(key, entry as CacheEntry<unknown>)
  }
  return entry
}

export function readSharedFetch<T>(fetcher: () => Promise<T>): CacheEntry<T> {
  return entryFor(fetcher)
}

export function isSharedFetchFresh<T>(fetcher: () => Promise<T>, maxAgeMs: number): boolean {
  const entry = entryFor(fetcher)
  if (entry.data === undefined && entry.error === undefined) return false
  return Date.now() - entry.updatedAt < maxAgeMs
}

export async function loadSharedFetch<T>(fetcher: () => Promise<T>): Promise<CacheEntry<T>> {
  const entry = entryFor(fetcher)
  if (entry.inflight) {
    await entry.inflight
    return entry
  }

  const pending = fetcher()
    .then((result) => {
      entry.data = result
      entry.error = undefined
      entry.updatedAt = Date.now()
    })
    .catch((err: unknown) => {
      entry.error = err instanceof Error ? err : new Error(String(err))
      entry.updatedAt = Date.now()
    })
    .finally(() => {
      if (entry.inflight === pending) entry.inflight = undefined
    })

  entry.inflight = pending
  await pending
  return entry
}

/** Test isolation only. */
export function resetSharedFetchCacheForTests(): void {
  cache.clear()
}
