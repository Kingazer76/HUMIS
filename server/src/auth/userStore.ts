import { randomUUID } from 'node:crypto'
import { DEFAULT_FARM_ID, type AccountStatus, type AuthUserPublic } from '@aquaflow/shared'
import { authUsersFile, persistAuthStore } from '../env.js'
import { readJsonFile, writeJsonFile } from './jsonFile.js'

export interface StoredUser {
  id: string
  fullName: string
  email: string
  passwordHash: string
  farmName: string | null
  farmId: string
  status: AccountStatus
  createdAt: string
  updatedAt: string
}

interface UsersFile {
  users: StoredUser[]
}

let memory: StoredUser[] | undefined

function load(): StoredUser[] {
  if (memory) return memory
  if (!persistAuthStore()) {
    memory = []
    return memory
  }
  memory = readJsonFile<UsersFile>(authUsersFile(), { users: [] }).users ?? []
  return memory
}

function save(): void {
  if (!memory) return
  if (!persistAuthStore()) return
  writeJsonFile(authUsersFile(), { users: memory })
}

export function listUsers(): StoredUser[] {
  return load()
}

export function findUserByEmail(email: string): StoredUser | undefined {
  return load().find((user) => user.email === email)
}

export function findUserById(id: string): StoredUser | undefined {
  return load().find((user) => user.id === id)
}

export function createUser(input: {
  fullName: string
  email: string
  passwordHash: string
  farmName: string | null
}): StoredUser {
  const now = new Date().toISOString()
  const user: StoredUser = {
    id: randomUUID(),
    fullName: input.fullName,
    email: input.email,
    passwordHash: input.passwordHash,
    farmName: input.farmName,
    farmId: DEFAULT_FARM_ID,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }
  load().push(user)
  save()
  return user
}

export function updateUserPassword(userId: string, passwordHash: string): StoredUser | undefined {
  const user = findUserById(userId)
  if (!user) return undefined
  user.passwordHash = passwordHash
  user.updatedAt = new Date().toISOString()
  save()
  return user
}

export function toPublicUser(user: StoredUser): AuthUserPublic {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    farmName: user.farmName,
    farmId: user.farmId,
    status: user.status,
    createdAt: user.createdAt,
  }
}

export function resetUsersForTests(): void {
  memory = []
}
