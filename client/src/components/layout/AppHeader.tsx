import { Droplets } from '@/lib/icons'
import { AssistantChat } from '@/components/assistant/AssistantChat'

/**
 * App header: droplet mark, AquaFlow AI wordmark, tagline, and the
 * AquaFlow Assistant chat button.
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

      <AssistantChat />
    </header>
  )
}
