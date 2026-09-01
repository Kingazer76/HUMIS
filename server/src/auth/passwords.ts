import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

/** scrypt cost. Slightly lighter under Vitest so the suite stays quick. */
const N = process.env.VITEST === 'true' ? 4096 : 16384
const R = 8
const P = 1
const KEY_LEN = 64

export function passwordIssues(password: string): string[] {
  const issues: string[] = []
  if (password.length < 8) issues.push('Use at least 8 characters.')
  if (password.length > 200) issues.push('Password is too long.')
  if (!/[A-Za-z]/.test(password)) issues.push('Include at least one letter.')
  if (!/[0-9]/.test(password)) issues.push('Include at least one number.')
  return issues
}

function deriveKey(password: string, salt: Buffer, n: number, r: number, p: number, keyLen: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLen, { N: n, r, p }, (err, derivedKey) => {
      if (err) reject(err)
      else resolve(derivedKey)
    })
  })
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await deriveKey(password, salt, N, R, P, KEY_LEN)
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64url')}$${key.toString('base64url')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const n = Number(parts[1])
  const r = Number(parts[2])
  const p = Number(parts[3])
  const salt = Buffer.from(parts[4], 'base64url')
  const expected = Buffer.from(parts[5], 'base64url')
  if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p) || salt.length === 0) {
    return false
  }
  const actual = await deriveKey(password, salt, n, r, p, expected.length)
  if (actual.length !== expected.length) return false
  return timingSafeEqual(actual, expected)
}

let dummyHashPromise: Promise<string> | undefined

/** Same work as a real check so missing accounts do not answer faster. */
export async function dummyPasswordCheck(password: string): Promise<void> {
  dummyHashPromise ??= hashPassword('humis-timing-pad')
  await verifyPassword(password, await dummyHashPromise)
}
