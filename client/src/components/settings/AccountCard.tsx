import { LogOut, User } from '@/lib/icons'
import { useAuth } from '@/auth/authContext'
import { Button } from '@/components/ui/button'
import { SectionCard } from '@/components/shared/SectionCard'

function formatJoined(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export function AccountCard() {
  const { user, logout } = useAuth()
  if (!user) return null

  return (
    <SectionCard
      icon={<User className="h-4 w-4" />}
      title="Your account"
      description="This is the HUMIS login for this farm computer."
    >
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Full name</dt>
          <dd className="mt-0.5 font-medium text-foreground">{user.fullName}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Email</dt>
          <dd className="mt-0.5 font-medium text-foreground">{user.email}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Farm or organization</dt>
          <dd className="mt-0.5 font-medium text-foreground">{user.farmName || 'Not set'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Account status</dt>
          <dd className="mt-0.5 font-medium text-foreground">
            {user.status === 'active' ? 'Active' : user.status}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Joined</dt>
          <dd className="mt-0.5 font-medium text-foreground">{formatJoined(user.createdAt)}</dd>
        </div>
      </dl>
      <div className="mt-4 border-t border-border pt-4">
        <Button variant="outline" onClick={() => void logout()}>
          <LogOut />
          Log out
        </Button>
      </div>
    </SectionCard>
  )
}
