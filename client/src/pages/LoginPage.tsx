import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AuthApiError, authApi } from '@/auth/authApi'
import { isValidEmail, safeNextPath } from '@/auth/rules'
import { useAuth } from '@/auth/authContext'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { PasswordField } from '@/components/auth/PasswordField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function LoginPage() {
  const { setUser } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const next = safeNextPath(new URLSearchParams(location.search).get('next'))

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState<string>()
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!isValidEmail(email)) {
      setError('Enter a valid email address.')
      return
    }
    if (!password) {
      setError('Enter your password.')
      return
    }
    setPending(true)
    setError(undefined)
    try {
      const user = await authApi.login({ email: email.trim(), password, rememberMe })
      setUser(user)
      navigate(next, { replace: true })
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : 'Could not sign in. Try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Use your HUMIS account to open the farm dashboard."
      footer={
        <>
          New to HUMIS?{' '}
          <Link to="/register" className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={(event) => void onSubmit(event)} noValidate>
        <div className="space-y-1.5">
          <label htmlFor="login-email" className="text-sm font-medium text-foreground">
            Email
          </label>
          <Input
            id="login-email"
            type="email"
            autoComplete="username"
            inputMode="email"
            value={email}
            aria-invalid={error ? true : undefined}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <PasswordField
          id="login-password"
          label="Password"
          value={password}
          autoComplete="current-password"
          invalid={Boolean(error)}
          onChange={setPassword}
        />

        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              className="size-4 rounded border-input accent-primary"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
            />
            Remember me
          </label>
          <Link to="/forgot-password" className="text-sm font-medium text-primary hover:underline">
            Forgot password?
          </Link>
        </div>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <Button type="submit" className="h-10 w-full" disabled={pending}>
          {pending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthLayout>
  )
}
