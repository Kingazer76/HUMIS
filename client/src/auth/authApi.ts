import type { AuthUserPublic } from '@aquaflow/shared'

export class AuthApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function parseError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string; message?: string }
    if (typeof body.error === 'string' && body.error.trim()) return body.error
    if (typeof body.message === 'string' && body.message.trim()) return body.message
  } catch {
    // Keep the fallback.
  }
  return fallback
}

async function send(path: string, init?: RequestInit): Promise<Response> {
  return fetch(path, {
    credentials: 'include',
    ...init,
    headers: init?.body
      ? { 'Content-Type': 'application/json', ...(init.headers ?? {}) }
      : init?.headers,
  })
}

export const authApi = {
  me: async (): Promise<AuthUserPublic | null> => {
    const res = await send('/api/auth/me')
    if (res.status === 401) return null
    if (!res.ok) throw new AuthApiError(await parseError(res, 'Could not check your HUMIS account.'), res.status)
    const body = (await res.json()) as { user: AuthUserPublic }
    return body.user
  },

  login: async (input: { email: string; password: string; rememberMe: boolean }): Promise<AuthUserPublic> => {
    const res = await send('/api/auth/login', { method: 'POST', body: JSON.stringify(input) })
    if (!res.ok) throw new AuthApiError(await parseError(res, 'Could not sign in.'), res.status)
    const body = (await res.json()) as { user: AuthUserPublic }
    return body.user
  },

  register: async (input: {
    fullName: string
    email: string
    password: string
    confirmPassword: string
    farmName: string
  }): Promise<AuthUserPublic> => {
    const res = await send('/api/auth/register', { method: 'POST', body: JSON.stringify(input) })
    if (!res.ok) throw new AuthApiError(await parseError(res, 'Could not create the account.'), res.status)
    const body = (await res.json()) as { user: AuthUserPublic }
    return body.user
  },

  logout: async (): Promise<void> => {
    await send('/api/auth/logout', { method: 'POST', body: JSON.stringify({}) })
  },

  forgotPassword: async (email: string): Promise<string> => {
    const res = await send('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) })
    if (!res.ok) throw new AuthApiError(await parseError(res, 'Could not start a password reset.'), res.status)
    const body = (await res.json()) as { message?: string }
    return body.message ?? 'If that email is on a HUMIS account, we sent password-reset instructions.'
  },

  resetPassword: async (input: {
    token: string
    password: string
    confirmPassword: string
  }): Promise<string> => {
    const res = await send('/api/auth/reset-password', { method: 'POST', body: JSON.stringify(input) })
    if (!res.ok) throw new AuthApiError(await parseError(res, 'Could not update the password.'), res.status)
    const body = (await res.json()) as { message?: string }
    return body.message ?? 'Password updated. Sign in with your new password.'
  },
}
