/**
 * Public account details returned to the browser.
 * Password hashes, session tokens, and reset tokens never appear here.
 */
export type AccountStatus = 'active'

export interface AuthUserPublic {
  id: string
  fullName: string
  email: string
  farmName: string | null
  /** Future multi-farm hook. Today every account uses the shared simulated farm. */
  farmId: string
  status: AccountStatus
  createdAt: string
}

export const DEFAULT_FARM_ID = 'default-farm'

export const AUTH_GENERIC_LOGIN_ERROR = 'Email or password is incorrect.'
export const AUTH_GENERIC_FORGOT_MESSAGE =
  'If that email is on a HUMIS account, we sent password-reset instructions.'
