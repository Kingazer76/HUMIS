import { hashPassword, passwordIssues } from './passwords.js'
import { createUser, findUserByEmail, listUsers } from './userStore.js'
import { isValidEmail, normalizeEmail, normalizeName } from './validation.js'

/**
 * Optional first account from env when the user file is empty.
 * Passwords still get hashed. Never logs the password.
 */
export async function bootstrapFirstUser(): Promise<void> {
  const email = normalizeEmail(process.env.AUTH_BOOTSTRAP_EMAIL)
  const password = (process.env.AUTH_BOOTSTRAP_PASSWORD ?? '').trim()
  if (!email && !password) return
  if (!isValidEmail(email) || passwordIssues(password).length > 0) {
    // eslint-disable-next-line no-console
    console.warn('[HUMIS] AUTH_BOOTSTRAP_EMAIL / AUTH_BOOTSTRAP_PASSWORD are set but invalid. Skipping.')
    return
  }
  if (findUserByEmail(email) || listUsers().length > 0) return

  const fullName = normalizeName(process.env.AUTH_BOOTSTRAP_NAME, 80) || 'HUMIS farmer'
  const farmNameRaw = normalizeName(process.env.AUTH_BOOTSTRAP_FARM_NAME, 120)
  createUser({
    fullName,
    email,
    passwordHash: await hashPassword(password),
    farmName: farmNameRaw || null,
  })
  // eslint-disable-next-line no-console
  console.info(`[HUMIS] Created the first account for ${email}.`)
}
