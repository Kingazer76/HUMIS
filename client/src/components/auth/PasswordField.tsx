import { useState } from 'react'
import { Eye, EyeOff } from '@/lib/icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  describedBy,
  invalid,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  autoComplete: string
  describedBy?: string
  invalid?: boolean
}) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          autoComplete={autoComplete}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className="pr-10"
          onChange={(event) => onChange(event.target.value)}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className={cn('absolute top-1/2 right-1.5 -translate-y-1/2 text-muted-foreground')}
          aria-label={visible ? 'Hide password' : 'Show password'}
          onClick={() => setVisible((on) => !on)}
        >
          {visible ? <EyeOff /> : <Eye />}
        </Button>
      </div>
    </div>
  )
}
