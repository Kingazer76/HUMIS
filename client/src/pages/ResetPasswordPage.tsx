import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AuthApiError, authApi } from '@/auth/authApi'
import { passwordIssues } from '@/auth/rules'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { PasswordField } from '@/components/auth/PasswordField'
import { Button } from '@/components/ui/button'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = (params.get('token') ?? '').trim()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string>()
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!token) {
      setError('This reset link is missing or incomplete. Request a new one.')
      return
    }
    const issues = passwordIssues(password)
    if (issues.length > 0) {
      setError(issues[0])
      return
    }
    if (password !== confirmPassword) {
      setError('Password confirmation does not match.')
      return
    }
    setPending(true)
    setError(undefined)
    try {
      await authApi.resetPassword({ token, password, confirmPassword })
      navigate('/login', { replace: true })
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : 'Could not update the password.')
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthLayout
      title="Choose a new password"
      subtitle="This link works once and expires after one hour."
      footer={
        <Link to="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={(event) => void onSubmit(event)} noValidate>
        {!token ? (
          <p className="text-sm text-destructive" role="alert">
            This reset link is missing. Use Forgot password to get a new one.
          </p>
        ) : null}
        <PasswordField
          id="reset-password"
          label="New password"
          value={password}
          autoComplete="new-password"
          onChange={setPassword}
        />
        <PasswordField
          id="reset-confirm"
          label="Confirm new password"
          value={confirmPassword}
          autoComplete="new-password"
          onChange={setConfirmPassword}
        />
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="h-10 w-full" disabled={pending || !token}>
          {pending ? 'Saving…' : 'Save new password'}
        </Button>
      </form>
    </AuthLayout>
  )
}
