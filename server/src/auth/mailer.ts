import { appPublicUrl, smtpConfig } from '../env.js'

export function resetLinkForToken(token: string): string {
  const base = appPublicUrl().replace(/\/$/, '')
  return `${base}/reset-password?token=${encodeURIComponent(token)}`
}

/**
 * Sends a password-reset email when SMTP is configured.
 * Never puts the token in an API response.
 */
export async function sendPasswordResetEmail(to: string, token: string): Promise<'sent' | 'logged'> {
  const url = resetLinkForToken(token)
  const smtp = smtpConfig()
  if (smtp) {
    const nodemailer = await import('nodemailer')
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
    })
    await transporter.sendMail({
      from: smtp.from,
      to,
      subject: 'Reset your HUMIS password',
      text: [
        'A password reset was requested for this HUMIS account.',
        '',
        `Open this link within one hour to choose a new password:`,
        url,
        '',
        'If you did not ask for this, you can ignore this email.',
      ].join('\n'),
    })
    return 'sent'
  }

  // Local/dev without mail: keep the token on the server only.
  // eslint-disable-next-line no-console
  console.info(`[HUMIS] Password reset for ${to}: ${url}`)
  return 'logged'
}

export function smtpConfigured(): boolean {
  return smtpConfig() !== undefined
}
