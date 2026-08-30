import { AssistantChat } from '@/components/assistant/AssistantChat'

/**
 * App header: AquaFlow logo, name, tagline, and the Assistant chat button.
 */
export function AppHeader() {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-border py-5">
      <div className="flex min-w-0 items-center gap-3">
        <img
          src="/logo.png?v=clear"
          alt=""
          className="h-12 w-12 shrink-0 bg-transparent object-contain sm:h-14 sm:w-14"
        />
        <div className="min-w-0">
          <h1 className="text-xl font-semibold leading-tight tracking-tight text-foreground">
            AquaFlow
          </h1>
          <p className="text-sm leading-tight text-muted-foreground">Smart Water Management</p>
        </div>
      </div>

      <AssistantChat />
    </header>
  )
}
