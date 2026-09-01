const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeEmail(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  return raw.trim().toLowerCase()
}

export function isValidEmail(email: string): boolean {
  if (email.length < 5 || email.length > 254) return false
  return EMAIL_RE.test(email)
}

export function normalizeName(raw: unknown, max: number): string {
  if (typeof raw !== 'string') return ''
  return raw.trim().replace(/\s+/g, ' ').slice(0, max)
}

export function readString(body: unknown, key: string): unknown {
  if (!body || typeof body !== 'object') return undefined
  return (body as Record<string, unknown>)[key]
}

export function readBoolean(body: unknown, key: string): boolean {
  const value = readString(body, key)
  return value === true
}
