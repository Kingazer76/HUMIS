export function passwordIssues(password: string): string[] {
  const issues: string[] = []
  if (password.length < 8) issues.push('Use at least 8 characters.')
  if (password.length > 200) issues.push('Password is too long.')
  if (!/[A-Za-z]/.test(password)) issues.push('Include at least one letter.')
  if (!/[0-9]/.test(password)) issues.push('Include at least one number.')
  return issues
}

export function isValidEmail(email: string): boolean {
  const trimmed = email.trim()
  if (trimmed.length < 5 || trimmed.length > 254) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
}

/** Only allow HUMIS pages after login — never an outside website. */
export function safeNextPath(raw: string | null): string {
  if (!raw) return '/overview'
  const path = raw.trim()
  if (!path.startsWith('/')) return '/overview'
  if (path.startsWith('//')) return '/overview'
  if (path.includes('://')) return '/overview'
  if (path.includes('\\')) return '/overview'
  if (path.includes('\n') || path.includes('\r')) return '/overview'
  if (
    path === '/login' ||
    path.startsWith('/login?') ||
    path === '/register' ||
    path.startsWith('/register?') ||
    path === '/forgot-password' ||
    path.startsWith('/forgot-password?') ||
    path === '/reset-password' ||
    path.startsWith('/reset-password?')
  ) {
    return '/overview'
  }
  return path
}
