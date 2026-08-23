import { Droplets, MessageCircle } from '@/lib/icons'
import { Button } from '@/components/ui/button'

/**
 * Reproduces V1's header: logo mark, "AquaFlow AI" wordmark, and tagline.
 * The assistant entry point lives here (decision: no new nav tab for it),
 * but stays disabled until Phase 5 wires up the AquaFlow Assistant.
 */
export function AppHeader() {
  return (
    <header className="flex items-center justify-between gap-4 py-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Droplets className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-xl font-semibold leading-tight text-foreground">
            AquaFlow <span className="text-primary">AI</span>
          </h1>
          <p className="text-sm leading-tight text-primary/80">Smart Water Management</p>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        size="icon"
        disabled
        title="AquaFlow Assistant — coming soon"
        aria-label="Open AquaFlow Assistant (coming soon)"
        className="rounded-full"
      >
        <MessageCircle className="h-4 w-4" aria-hidden="true" />
      </Button>
    </header>
  )
}
