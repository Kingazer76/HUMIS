import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AuthApiError, authApi } from '@/auth/authApi'
import { isValidEmail } from '@/auth/rules'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string>()
  const [message, setMessage] = useState<string>()
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!isValidEmail(email)) {
      setError('Enter a valid email address.')
      return
    }
    setPending(true)
    setError(undefined)
    setMessage(undefined)
    try {
      setMessage(await authApi.forgotPassword(email.trim()))
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : 'Could not start a password reset.')
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthLayout
      title="Forgot password"
      subtitle="Enter the email on your HUMIS account. If it matches, we send a reset link."
      footer={
        <Link to="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={(event) => void onSubmit(event)} noValidate>
        <div className="space-y-1.5">
          <label htmlFor="forgot-email" className="text-sm font-medium text-foreground">
            Email
          </label>
          <Input
            id="forgot-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="text-sm text-foreground" role="status">
            {message} If this computer is running HUMIS without email set up, the farm manager can find the
            reset link in the server log.
          </p>
        ) : null}
        <Button type="submit" className="h-10 w-full" disabled={pending}>
          {pending ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>
    </AuthLayout>
  )
}
