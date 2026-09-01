import { Router } from 'express'
import {
  AUTH_GENERIC_FORGOT_MESSAGE,
  AUTH_GENERIC_LOGIN_ERROR,
  type AuthUserPublic,
} from '@aquaflow/shared'
import { clearSessionCookie, readSessionToken, setSessionCookie } from './cookies.js'
import { sendPasswordResetEmail } from './mailer.js'
import { loadSessionUser, type AuthedRequest } from './middleware.js'
import { dummyPasswordCheck, hashPassword, passwordIssues, verifyPassword } from './passwords.js'
import { clientIp, loginLockMessage, recordLoginFailure, recordLoginSuccess } from './rateLimit.js'
import { consumeResetToken, createResetToken } from './resetStore.js'
import { createSession, deleteSession, deleteSessionsForUser } from './sessionStore.js'
import {
  createUser,
  findUserByEmail,
  findUserById,
  toPublicUser,
  updateUserPassword,
} from './userStore.js'
import { isValidEmail, normalizeEmail, normalizeName, readBoolean, readString } from './validation.js'

export const authRouter = Router()

const JSON_TYPE = /application\/json/i

authRouter.use((req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD') {
    next()
    return
  }
  const type = req.headers['content-type'] ?? ''
  if (!JSON_TYPE.test(type)) {
    res.status(415).json({ error: 'Send JSON from the HUMIS app.' })
    return
  }
  next()
})

function currentUser(req: AuthedRequest): AuthUserPublic | undefined {
  return req.authUser ?? loadSessionUser(req)
}

authRouter.post('/register', async (req, res) => {
  const fullName = normalizeName(readString(req.body, 'fullName'), 80)
  const email = normalizeEmail(readString(req.body, 'email'))
  const password = typeof readString(req.body, 'password') === 'string' ? String(readString(req.body, 'password')) : ''
  const confirm =
    typeof readString(req.body, 'confirmPassword') === 'string' ? String(readString(req.body, 'confirmPassword')) : ''
  const farmNameRaw = normalizeName(readString(req.body, 'farmName'), 120)
  const farmName = farmNameRaw.length === 0 ? null : farmNameRaw

  const errors: string[] = []
  if (fullName.length < 2) errors.push('Enter your full name.')
  if (!isValidEmail(email)) errors.push('Enter a valid email address.')
  errors.push(...passwordIssues(password))
  if (password !== confirm) errors.push('Password confirmation does not match.')
  if (errors.length > 0) {
    res.status(400).json({ error: errors[0], errors })
    return
  }
  if (findUserByEmail(email)) {
    res.status(409).json({ error: 'An account with that email already exists. Sign in instead.' })
    return
  }

  const user = createUser({
    fullName,
    email,
    passwordHash: await hashPassword(password),
    farmName,
  })
  const { token } = createSession(user.id, false)
  setSessionCookie(req, res, token, false)
  res.status(201).json({ user: toPublicUser(user) })
})

authRouter.post('/login', async (req, res) => {
  const email = normalizeEmail(readString(req.body, 'email') ?? readString(req.body, 'username'))
  const password = typeof readString(req.body, 'password') === 'string' ? String(readString(req.body, 'password')) : ''
  const rememberMe = readBoolean(req.body, 'rememberMe')
  const ip = clientIp(req)

  if (!isValidEmail(email) || !password) {
    res.status(400).json({ error: AUTH_GENERIC_LOGIN_ERROR })
    return
  }

  const locked = loginLockMessage(email, ip)
  if (locked) {
    res.status(429).json({ error: locked })
    return
  }

  const user = findUserByEmail(email)
  if (!user) {
    await dummyPasswordCheck(password)
    recordLoginFailure(email, ip)
    res.status(401).json({ error: AUTH_GENERIC_LOGIN_ERROR })
    return
  }
  const ok = await verifyPassword(password, user.passwordHash)
  if (!ok || user.status !== 'active') {
    recordLoginFailure(email, ip)
    res.status(401).json({ error: AUTH_GENERIC_LOGIN_ERROR })
    return
  }

  recordLoginSuccess(email, ip)
  const { token } = createSession(user.id, rememberMe)
  setSessionCookie(req, res, token, rememberMe)
  res.json({ user: toPublicUser(user) })
})

authRouter.post('/logout', (req, res) => {
  deleteSession(readSessionToken(req))
  clearSessionCookie(req, res)
  res.json({ ok: true })
})

authRouter.get('/me', (req, res) => {
  const user = currentUser(req)
  if (!user) {
    res.status(401).json({ error: 'Please sign in to continue.' })
    return
  }
  res.json({ user })
})

authRouter.post('/forgot-password', async (req, res) => {
  const email = normalizeEmail(readString(req.body, 'email'))
  const reply = () => res.json({ ok: true, message: AUTH_GENERIC_FORGOT_MESSAGE })
  if (!isValidEmail(email)) {
    reply()
    return
  }
  const user = findUserByEmail(email)
  if (!user) {
    reply()
    return
  }
  const token = createResetToken(user.id)
  try {
    await sendPasswordResetEmail(user.email, token)
  } catch {
    // eslint-disable-next-line no-console
    console.error('[HUMIS] Password reset email failed.')
  }
  reply()
})

authRouter.post('/reset-password', async (req, res) => {
  const token = typeof readString(req.body, 'token') === 'string' ? String(readString(req.body, 'token')).trim() : ''
  const password = typeof readString(req.body, 'password') === 'string' ? String(readString(req.body, 'password')) : ''
  const confirm =
    typeof readString(req.body, 'confirmPassword') === 'string' ? String(readString(req.body, 'confirmPassword')) : ''

  if (!token || token.length < 32) {
    res.status(400).json({ error: 'This reset link is invalid or has expired.' })
    return
  }
  const issues = passwordIssues(password)
  if (password !== confirm) issues.push('Password confirmation does not match.')
  if (issues.length > 0) {
    res.status(400).json({ error: issues[0], errors: issues })
    return
  }

  const consumed = consumeResetToken(token)
  if (!consumed) {
    res.status(400).json({ error: 'This reset link is invalid or has expired.' })
    return
  }
  const user = findUserById(consumed.userId)
  if (!user) {
    res.status(400).json({ error: 'This reset link is invalid or has expired.' })
    return
  }

  updateUserPassword(user.id, await hashPassword(password))
  deleteSessionsForUser(user.id)
  res.json({ ok: true, message: 'Password updated. Sign in with your new password.' })
})
