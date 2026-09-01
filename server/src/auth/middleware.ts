import type { NextFunction, Request, Response } from 'express'
import type { AuthUserPublic } from '@aquaflow/shared'
import { readSessionToken } from './cookies.js'
import { findSession } from './sessionStore.js'
import { findUserById, toPublicUser } from './userStore.js'

export interface AuthedRequest extends Request {
  authUser?: AuthUserPublic
}

export function loadSessionUser(req: Request): AuthUserPublic | undefined {
  const token = readSessionToken(req)
  const session = findSession(token)
  if (!session) return undefined
  const user = findUserById(session.userId)
  if (!user || user.status !== 'active') return undefined
  return toPublicUser(user)
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const user = loadSessionUser(req)
  if (!user) {
    res.status(401).json({ error: 'Please sign in to continue.' })
    return
  }
  ;(req as AuthedRequest).authUser = user
  next()
}
