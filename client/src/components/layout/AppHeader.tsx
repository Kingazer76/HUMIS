import { AssistantChat } from '@/components/assistant/AssistantChat'
import { LogOut } from '@/lib/icons'
import { useAuth } from '@/auth/authContext'
import { Button } from '@/components/ui/button'

/**
 * App header: hexagon mark, HUMIS wordmark from the original logo art,
 * the Assistant chat button, and a compact log out action.
 */
export function AppHeader() {
  const { user, logout } = useAuth()
  const firstName = (user?.fullName ?? '').trim().split(/\s+/).filter(Boolean)[0]

  return (
    <header className="flex items-center justify-between gap-4 border-b border-border py-5">
      <div className="flex min-w-0 items-center gap-3">
        <img
          src="/logo.png?v=clear"
          alt=""
          className="h-12 w-12 shrink-0 bg-transparent object-contain sm:h-14 sm:w-14"
        />
        <h1 className="m-0 min-w-0">
          <span className="sr-only">HUMIS</span>
          <img
            src="/humis-wordmark.png"
            alt=""
            className="h-7 w-auto max-w-full bg-transparent object-contain sm:h-8"
          />
        </h1>
      </div>

      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        {firstName ? (
          <p className="hidden max-w-32 truncate text-sm text-muted-foreground sm:block" title={user?.email}>
            {firstName}
          </p>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="hidden sm:inline-flex"
          onClick={() => void logout()}
        >
          <LogOut />
          Log out
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="sm:hidden"
          aria-label="Log out"
          onClick={() => void logout()}
        >
          <LogOut />
        </Button>
        <AssistantChat />
      </div>
    </header>
  )
}
