import { AssistantChat } from '@/components/assistant/AssistantChat'

/**
 * App header: hexagon mark, HUMIS wordmark from the original logo art,
 * and the Assistant chat button. No tagline.
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
        <h1 className="m-0 min-w-0">
          <span className="sr-only">HUMIS</span>
          <img
            src="/humis-wordmark.png"
            alt=""
            className="h-7 w-auto max-w-full bg-transparent object-contain sm:h-8"
          />
        </h1>
      </div>

      <AssistantChat />
    </header>
  )
}
