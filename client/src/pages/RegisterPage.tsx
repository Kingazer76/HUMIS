import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthApiError, authApi } from '@/auth/authApi'
import { isValidEmail, passwordIssues } from '@/auth/rules'
import { useAuth } from '@/auth/authContext'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { PasswordField } from '@/components/auth/PasswordField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function RegisterPage() {
  const { setUser } = useAuth()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [farmName, setFarmName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string>()
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (fullName.trim().length < 2) {
      setError('Enter your full name.')
      return
    }
    if (!isValidEmail(email)) {
      setError('Enter a valid email address.')
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
      const user = await authApi.register({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        confirmPassword,
        farmName: farmName.trim(),
      })
      setUser(user)
      navigate('/overview', { replace: true })
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : 'Could not create the account. Try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthLayout
      title="Create an account"
      subtitle="One HUMIS account per person. You can add your farm name if you want."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={(event) => void onSubmit(event)} noValidate>
        <div className="space-y-1.5">
          <label htmlFor="register-name" className="text-sm font-medium text-foreground">
            Full name
          </label>
          <Input
            id="register-name"
            autoComplete="name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="register-email" className="text-sm font-medium text-foreground">
            Email
          </label>
          <Input
            id="register-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="register-farm" className="text-sm font-medium text-foreground">
            Farm or organization <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <Input
            id="register-farm"
            autoComplete="organization"
            value={farmName}
            onChange={(event) => setFarmName(event.target.value)}
          />
        </div>
        <PasswordField
          id="register-password"
          label="Password"
          value={password}
          autoComplete="new-password"
          describedBy="register-password-hint"
          onChange={setPassword}
        />
        <p id="register-password-hint" className="text-xs text-muted-foreground">
          At least 8 characters, with a letter and a number.
        </p>
        <PasswordField
          id="register-confirm"
          label="Confirm password"
          value={confirmPassword}
          autoComplete="new-password"
          onChange={setConfirmPassword}
        />
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="h-10 w-full" disabled={pending}>
          {pending ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthLayout>
  )
}
