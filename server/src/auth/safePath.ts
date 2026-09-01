/**
 * Only allow in-app return paths after login.
 * Blocks open redirects such as //evil.example or https://evil.example.
 */
export function safeReturnPath(raw: unknown): string {
  if (typeof raw !== 'string') return '/overview'
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
