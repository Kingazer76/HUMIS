import { createHash, randomBytes } from 'node:crypto'
import { authResetFile, authSessionSecret, persistAuthStore } from '../env.js'
import { readJsonFile, writeJsonFile } from './jsonFile.js'

export const RESET_TTL_MS = 60 * 60 * 1000

interface StoredReset {
  tokenHash: string
  userId: string
  expiresAt: string
  used: boolean
}

interface ResetFile {
  tokens: StoredReset[]
}

let memory: StoredReset[] | undefined

function load(): StoredReset[] {
  if (memory) return memory
  if (!persistAuthStore()) {
    memory = []
    return memory
  }
  memory = readJsonFile<ResetFile>(authResetFile(), { tokens: [] }).tokens ?? []
  return memory
}

function save(): void {
  if (!memory) return
  if (!persistAuthStore()) return
  const now = Date.now()
  memory = memory.filter((row) => !row.used && Date.parse(row.expiresAt) > now)
  writeJsonFile(authResetFile(), { tokens: memory })
}

function hashToken(token: string): string {
  return createHash('sha256').update(authSessionSecret()).update(token).digest('hex')
}

export function createResetToken(userId: string): string {
  const token = randomBytes(32).toString('hex')
  load().push({
    tokenHash: hashToken(token),
    userId,
    expiresAt: new Date(Date.now() + RESET_TTL_MS).toISOString(),
    used: false,
  })
  save()
  return token
}

export function consumeResetToken(token: string): { userId: string } | undefined {
  const tokenHash = hashToken(token)
  const row = load().find((item) => item.tokenHash === tokenHash)
  if (!row || row.used) return undefined
  if (Date.parse(row.expiresAt) <= Date.now()) return undefined
  row.used = true
  save()
  return { userId: row.userId }
}

export function peekResetTokenForTests(token: string): StoredReset | undefined {
  return load().find((item) => item.tokenHash === hashToken(token))
}

export function resetPasswordTokensForTests(): void {
  memory = []
}
