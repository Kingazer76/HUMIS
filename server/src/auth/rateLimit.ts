interface AttemptBucket {
  count: number
  resetAt: number
  lockedUntil: number
}

const WINDOW_MS = 15 * 60 * 1000
const MAX_FAILURES = 8
const LOCK_MS = 15 * 60 * 1000

const byKey = new Map<string, AttemptBucket>()

function bucket(key: string): AttemptBucket {
  const now = Date.now()
  const existing = byKey.get(key)
  if (!existing || existing.resetAt <= now) {
    const fresh = { count: 0, resetAt: now + WINDOW_MS, lockedUntil: 0 }
    byKey.set(key, fresh)
    return fresh
  }
  return existing
}

export function loginLockMessage(email: string, ip: string): string | undefined {
  if (process.env.VITEST === 'true' && process.env.HUMIS_TEST_RATE_LIMIT !== '1') {
    return undefined
  }
  const now = Date.now()
  for (const key of [`email:${email}`, `ip:${ip}`]) {
    const item = bucket(key)
    if (item.lockedUntil > now) {
      return 'Too many sign-in tries. Wait a few minutes and try again.'
    }
  }
  return undefined
}

export function recordLoginFailure(email: string, ip: string): void {
  if (process.env.VITEST === 'true' && process.env.HUMIS_TEST_RATE_LIMIT !== '1') {
    return
  }
  const now = Date.now()
  for (const key of [`email:${email}`, `ip:${ip}`]) {
    const item = bucket(key)
    item.count += 1
    if (item.count >= MAX_FAILURES) {
      item.lockedUntil = now + LOCK_MS
    }
  }
}

export function recordLoginSuccess(email: string, ip: string): void {
  byKey.delete(`email:${email}`)
  byKey.delete(`ip:${ip}`)
}

export function clientIp(req: { ip?: string; headers: Record<string, unknown>; socket?: { remoteAddress?: string } }): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim().slice(0, 64)
  }
  return (req.ip || req.socket?.remoteAddress || 'unknown').slice(0, 64)
}

export function resetRateLimitForTests(): void {
  byKey.clear()
}
