import { afterEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { AUTH_GENERIC_FORGOT_MESSAGE, AUTH_GENERIC_LOGIN_ERROR } from '@aquaflow/shared'
import { createApp } from '../app.js'
import { TEST_EMAIL, TEST_PASSWORD, createAuthedAgent } from '../test/authedAgent.js'
import { hashPassword, passwordIssues } from './passwords.js'
import { resetRateLimitForTests } from './rateLimit.js'
import { createResetToken, peekResetTokenForTests } from './resetStore.js'
import { expireSessionForTests } from './sessionStore.js'
import { createUser, findUserByEmail } from './userStore.js'
import { safeReturnPath } from './safePath.js'
import { readCookie } from './cookies.js'

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@humis.test`
}

afterEach(() => {
  resetRateLimitForTests()
})

describe('password rules', () => {
  it('rejects short or letter-only passwords', () => {
    expect(passwordIssues('ab12')).toContain('Use at least 8 characters.')
    expect(passwordIssues('abcdefgh')).toContain('Include at least one number.')
    expect(passwordIssues('12345678')).toContain('Include at least one letter.')
    expect(passwordIssues('FarmWater-92')).toEqual([])
  })
})

describe('safeReturnPath', () => {
  it('allows in-app paths and blocks open redirects', () => {
    expect(safeReturnPath('/overview')).toBe('/overview')
    expect(safeReturnPath('/irrigation?x=1')).toBe('/irrigation?x=1')
    expect(safeReturnPath('https://evil.example')).toBe('/overview')
    expect(safeReturnPath('//evil.example')).toBe('/overview')
    expect(safeReturnPath('/login')).toBe('/overview')
    expect(safeReturnPath('\\evil')).toBe('/overview')
  })
})

describe('auth HTTP', () => {
  it('keeps /api/health public', async () => {
    const app = createApp()
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
  })

  it('rejects farm APIs without a session', async () => {
    const app = createApp()
    const water = await request(app).get('/api/water')
    expect(water.status).toBe(401)
    const chat = await request(app).post('/api/assistant/chat').send({ message: 'How much water?' })
    expect(chat.status).toBe(401)
    const speech = await request(app).post('/api/assistant/speech').set('Content-Type', 'audio/wav').send(Buffer.alloc(8))
    expect(speech.status).toBe(401)
  })

  it('registers, signs in, and restores the session', async () => {
    const app = createApp()
    const email = uniqueEmail('reg')
    const created = await request(app).post('/api/auth/register').send({
      fullName: 'Ama Mensah',
      email,
      password: 'FarmWater-92',
      confirmPassword: 'FarmWater-92',
      farmName: 'Ama Farms',
    })
    expect(created.status).toBe(201)
    expect(created.body.user.email).toBe(email)
    expect(created.body.user.fullName).toBe('Ama Mensah')
    expect(created.body.user.farmName).toBe('Ama Farms')
    expect(created.body.user.passwordHash).toBeUndefined()
    expect(created.headers['set-cookie']).toBeTruthy()

    const me = await request(app).get('/api/auth/me').set('Cookie', created.headers['set-cookie'])
    expect(me.status).toBe(200)
    expect(me.body.user.email).toBe(email)

    const water = await request(app).get('/api/water').set('Cookie', created.headers['set-cookie'])
    expect(water.status).toBe(200)
    expect(typeof water.body.mainTankL.value).toBe('number')
  })

  it('rejects a duplicate email', async () => {
    const app = createApp()
    const email = uniqueEmail('dup')
    const body = {
      fullName: 'Kojo Boateng',
      email,
      password: 'FarmWater-92',
      confirmPassword: 'FarmWater-92',
    }
    expect((await request(app).post('/api/auth/register').send(body)).status).toBe(201)
    const again = await request(app).post('/api/auth/register').send(body)
    expect(again.status).toBe(409)
    expect(again.body.error).toMatch(/already exists/i)
  })

  it('rejects a weak password and mismatched confirmation', async () => {
    const app = createApp()
    const weak = await request(app).post('/api/auth/register').send({
      fullName: 'Test Farmer',
      email: uniqueEmail('weak'),
      password: 'short',
      confirmPassword: 'short',
    })
    expect(weak.status).toBe(400)

    const mismatch = await request(app).post('/api/auth/register').send({
      fullName: 'Test Farmer',
      email: uniqueEmail('mis'),
      password: 'FarmWater-92',
      confirmPassword: 'FarmWater-93',
    })
    expect(mismatch.status).toBe(400)
    expect(mismatch.body.error).toMatch(/match/i)
  })

  it('uses the same error for a bad password and a missing account', async () => {
    const app = createApp()
    const email = uniqueEmail('login')
    await request(app).post('/api/auth/register').send({
      fullName: 'Test Farmer',
      email,
      password: 'FarmWater-92',
      confirmPassword: 'FarmWater-92',
    })

    const badPassword = await request(app).post('/api/auth/login').send({
      email,
      password: 'WrongPass-11',
    })
    const missing = await request(app).post('/api/auth/login').send({
      email: uniqueEmail('missing'),
      password: 'FarmWater-92',
    })
    expect(badPassword.status).toBe(401)
    expect(missing.status).toBe(401)
    expect(badPassword.body.error).toBe(AUTH_GENERIC_LOGIN_ERROR)
    expect(missing.body.error).toBe(AUTH_GENERIC_LOGIN_ERROR)
  })

  it('logs out and then blocks farm APIs', async () => {
    const app = createApp()
    const agent = request.agent(app)
    await agent.post('/api/auth/register').send({
      fullName: 'Test Farmer',
      email: uniqueEmail('out'),
      password: 'FarmWater-92',
      confirmPassword: 'FarmWater-92',
    })
    expect((await agent.get('/api/water')).status).toBe(200)
    expect((await agent.post('/api/auth/logout').send({})).status).toBe(200)
    expect((await agent.get('/api/water')).status).toBe(401)
    expect((await agent.get('/api/auth/me')).status).toBe(401)
  })

  it('rejects an expired session', async () => {
    const app = createApp()
    const agent = request.agent(app)
    const created = await agent.post('/api/auth/register').send({
      fullName: 'Test Farmer',
      email: uniqueEmail('exp'),
      password: 'FarmWater-92',
      confirmPassword: 'FarmWater-92',
    })
    const cookieHeader = String(created.headers['set-cookie'])
    const token = /humis_session=([a-f0-9]+)/i.exec(cookieHeader)?.[1]
    expect(token).toBeTruthy()
    expireSessionForTests(token!)
    expect((await agent.get('/api/water')).status).toBe(401)
  })

  it('resets a password with a one-time token and does not echo the token', async () => {
    const app = createApp()
    const email = uniqueEmail('reset')
    await request(app).post('/api/auth/register').send({
      fullName: 'Test Farmer',
      email,
      password: 'FarmWater-92',
      confirmPassword: 'FarmWater-92',
    })
    const user = findUserByEmail(email)
    expect(user).toBeTruthy()
    const token = createResetToken(user!.id)

    const forgot = await request(app).post('/api/auth/forgot-password').send({ email })
    expect(forgot.status).toBe(200)
    expect(forgot.body.message).toBe(AUTH_GENERIC_FORGOT_MESSAGE)
    expect(JSON.stringify(forgot.body)).not.toMatch(token)

    const unknown = await request(app).post('/api/auth/forgot-password').send({
      email: uniqueEmail('nobody'),
    })
    expect(unknown.status).toBe(200)
    expect(unknown.body.message).toBe(AUTH_GENERIC_FORGOT_MESSAGE)

    const reset = await request(app).post('/api/auth/reset-password').send({
      token,
      password: 'NewWater-44',
      confirmPassword: 'NewWater-44',
    })
    expect(reset.status).toBe(200)

    const reused = await request(app).post('/api/auth/reset-password').send({
      token,
      password: 'NewWater-55',
      confirmPassword: 'NewWater-55',
    })
    expect(reused.status).toBe(400)

    const oldLogin = await request(app).post('/api/auth/login').send({
      email,
      password: 'FarmWater-92',
    })
    expect(oldLogin.status).toBe(401)

    const nextLogin = await request(app).post('/api/auth/login').send({
      email,
      password: 'NewWater-44',
    })
    expect(nextLogin.status).toBe(200)
    expect(peekResetTokenForTests(token)?.used).toBe(true)
  })

  it('never stores a plaintext password', async () => {
    const hash = await hashPassword('FarmWater-92')
    expect(hash.startsWith('scrypt$')).toBe(true)
    expect(hash.includes('FarmWater-92')).toBe(false)
    const user = createUser({
      fullName: 'Hash Check',
      email: uniqueEmail('hash'),
      passwordHash: hash,
      farmName: null,
    })
    expect(JSON.stringify(user)).not.toContain('FarmWater-92')
  })
})

describe('authenticated helper used by farm tests', () => {
  it('can read water after createAuthedAgent', async () => {
    const app = createApp()
    const agent = await createAuthedAgent(app)
    const res = await agent.get('/api/water')
    expect(res.status).toBe(200)
    expect(TEST_EMAIL).toMatch(/humis.test/)
    expect(TEST_PASSWORD.length).toBeGreaterThan(8)
  })
})

describe('readCookie', () => {
  it('reads a named cookie', () => {
    const req = { headers: { cookie: 'a=1; humis_session=abc123; b=2' } } as Parameters<typeof readCookie>[0]
    expect(readCookie(req, 'humis_session')).toBe('abc123')
  })
})
