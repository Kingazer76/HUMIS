import { Droplets, MessageCircle } from '@/lib/icons'
import { Button } from '@/components/ui/button'

/**
 * App header: droplet mark, AquaFlow AI wordmark, and tagline.
 * The assistant button stays disabled until a later phase wires it up.
 */
export function AppHeader() {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-border py-5">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <Droplets className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-xl font-semibold leading-tight tracking-tight text-foreground">
            AquaFlow <span className="text-primary">AI</span>
          </h1>
          <p className="text-sm leading-tight text-muted-foreground">Smart Water Management</p>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        size="icon"
        disabled
        title="AquaFlow Assistant — coming soon"
        aria-label="Open AquaFlow Assistant (coming soon)"
        className="rounded-full border-2"
      >
        <MessageCircle className="h-4 w-4" aria-hidden="true" />
      </Button>
    </header>
  )
}
