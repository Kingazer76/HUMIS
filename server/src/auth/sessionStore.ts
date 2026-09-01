import { createHash, randomBytes } from 'node:crypto'
import { authSessionSecret, authSessionsFile, persistAuthStore } from '../env.js'
import { readJsonFile, writeJsonFile } from './jsonFile.js'

export const SESSION_COOKIE = 'humis_session'
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000
export const REMEMBER_TTL_MS = 30 * 24 * 60 * 60 * 1000

export interface StoredSession {
  idHash: string
  userId: string
  createdAt: string
  expiresAt: string
  rememberMe: boolean
}

interface SessionsFile {
  sessions: StoredSession[]
}

let memory: StoredSession[] | undefined

function load(): StoredSession[] {
  if (memory) return memory
  if (!persistAuthStore()) {
    memory = []
    return memory
  }
  memory = readJsonFile<SessionsFile>(authSessionsFile(), { sessions: [] }).sessions ?? []
  return memory
}

function save(): void {
  if (!memory) return
  if (!persistAuthStore()) return
  const now = Date.now()
  memory = memory.filter((session) => Date.parse(session.expiresAt) > now)
  writeJsonFile(authSessionsFile(), { sessions: memory })
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(authSessionSecret()).update(token).digest('hex')
}

export function createSession(userId: string, rememberMe: boolean): { token: string; session: StoredSession } {
  const token = randomBytes(32).toString('hex')
  const ttl = rememberMe ? REMEMBER_TTL_MS : SESSION_TTL_MS
  const now = new Date()
  const session: StoredSession = {
    idHash: hashSessionToken(token),
    userId,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttl).toISOString(),
    rememberMe,
  }
  load().push(session)
  save()
  return { token, session }
}

export function findSession(token: string | undefined): StoredSession | undefined {
  if (!token) return undefined
  const idHash = hashSessionToken(token)
  const session = load().find((row) => row.idHash === idHash)
  if (!session) return undefined
  if (Date.parse(session.expiresAt) <= Date.now()) {
    deleteSession(token)
    return undefined
  }
  return session
}

export function deleteSession(token: string | undefined): void {
  if (!token) return
  const idHash = hashSessionToken(token)
  memory = load().filter((row) => row.idHash !== idHash)
  save()
}

export function deleteSessionsForUser(userId: string): void {
  memory = load().filter((row) => row.userId !== userId)
  save()
}

export function expireSessionForTests(token: string): void {
  const session = findSession(token)
  if (!session) return
  session.expiresAt = new Date(Date.now() - 1000).toISOString()
  save()
}

export function resetSessionsForTests(): void {
  memory = []
}
