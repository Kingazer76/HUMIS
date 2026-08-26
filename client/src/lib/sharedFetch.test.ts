import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  isSharedFetchFresh,
  loadSharedFetch,
  readSharedFetch,
  resetSharedFetchCacheForTests,
} from './sharedFetch'

describe('sharedFetch', () => {
  afterEach(() => {
    resetSharedFetchCacheForTests()
    vi.restoreAllMocks()
  })

  it('remembers the last successful result as fresh', async () => {
    const fetcher = vi.fn(async () => ({ liters: 100 }))
    await loadSharedFetch(fetcher)
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(isSharedFetchFresh(fetcher, 5_000)).toBe(true)
    expect(readSharedFetch(fetcher).data).toEqual({ liters: 100 })
  })

  it('treats a successful result as stale after maxAgeMs', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000)
    const fetcher = vi.fn(async () => ({ liters: 100 }))
    await loadSharedFetch(fetcher)
    expect(isSharedFetchFresh(fetcher, 5_000)).toBe(true)
    vi.setSystemTime(7_000)
    expect(isSharedFetchFresh(fetcher, 5_000)).toBe(false)
    vi.useRealTimers()
  })

  it('coalesces overlapping fetches for the same helper', async () => {
    let finish!: (value: string) => void
    const fetcher = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve
        }),
    )

    const first = loadSharedFetch(fetcher)
    const second = loadSharedFetch(fetcher)
    expect(fetcher).toHaveBeenCalledTimes(1)
    finish('ok')
    await Promise.all([first, second])
    expect(readSharedFetch(fetcher).data).toBe('ok')
  })
})
