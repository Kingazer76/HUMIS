import type { CookieOptions, Request, Response } from 'express'
import { SESSION_COOKIE, SESSION_TTL_MS, REMEMBER_TTL_MS } from './sessionStore.js'

function cookieSecure(req: Request): boolean {
  if (process.env.AUTH_COOKIE_SECURE === 'true') return true
  if (process.env.AUTH_COOKIE_SECURE === 'false') return false
  const forwarded = req.headers['x-forwarded-proto']
  const proto = Array.isArray(forwarded) ? forwarded[0] : forwarded
  return req.secure || proto === 'https'
}

export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie
  if (!header) return undefined
  for (const part of header.split(';')) {
    const trimmed = part.trim()
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    if (trimmed.slice(0, eq) !== name) continue
    return decodeURIComponent(trimmed.slice(eq + 1))
  }
  return undefined
}

export function readSessionToken(req: Request): string | undefined {
  const token = readCookie(req, SESSION_COOKIE)
  if (!token || token.length < 32 || token.length > 128) return undefined
  if (!/^[a-f0-9]+$/i.test(token)) return undefined
  return token
}

export function setSessionCookie(req: Request, res: Response, token: string, rememberMe: boolean): void {
  const options: CookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: cookieSecure(req),
    path: '/',
  }
  if (rememberMe) options.maxAge = REMEMBER_TTL_MS
  else options.maxAge = SESSION_TTL_MS
  res.cookie(SESSION_COOKIE, token, options)
}

export function clearSessionCookie(req: Request, res: Response): void {
  res.cookie(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: cookieSecure(req),
    path: '/',
    maxAge: 0,
  })
}
