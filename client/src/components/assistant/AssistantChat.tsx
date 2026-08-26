import { useEffect, useRef, useState } from 'react'
import { MessageCircle, Send } from '@/lib/icons'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

interface ChatMessage {
  id: number
  role: 'user' | 'assistant'
  text: string
}

const SUGGESTIONS = [
  'How much water is in the tank?',
  'Do my crops need water?',
  'Start watering',
  'Stop watering',
]

/**
 * Header chat for the AquaFlow Assistant. Questions use existing farm
 * numbers. Watering commands go to `/api/assistant/chat`, which only
 * actuates through `safetyController`.
 */
export function AssistantChat() {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const nextId = useRef(1)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages, pending])

  async function send(text: string) {
    const message = text.trim()
    if (!message || pending) return

    const userMsg: ChatMessage = { id: nextId.current++, role: 'user', text: message }
    setMessages((current) => [...current, userMsg])
    setDraft('')
    setPending(true)
    setError(undefined)

    try {
      const result = await api.sendAssistantMessage(message)
      setMessages((current) => [
        ...current,
        { id: nextId.current++, role: 'assistant', text: result.reply },
      ])
    } catch {
      setError("Can't reach the AquaFlow server. Try again.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="icon"
            title="AquaFlow Assistant"
            aria-label="Open AquaFlow Assistant"
            className="rounded-full border-2"
          />
        }
      >
        <MessageCircle className="h-4 w-4" aria-hidden="true" />
      </DialogTrigger>
      <DialogContent
        className="flex max-h-[min(36rem,85svh)] w-full flex-col gap-3 sm:max-w-lg"
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle>AquaFlow Assistant</DialogTitle>
          <DialogDescription>
            Ask about your water, fields, or weather. I use the same safety gate as the Irrigation
            buttons.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-lg border border-border bg-muted/40 p-3">
          {messages.length === 0 && !pending ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">Try one of these:</p>
              <div className="flex flex-col gap-2">
                {SUGGESTIONS.map((suggestion) => (
                  <Button
                    key={suggestion}
                    type="button"
                    variant="outline"
                    className="h-auto justify-start whitespace-normal py-2 text-left"
                    onClick={() => void send(suggestion)}
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'max-w-[90%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap',
                  message.role === 'user'
                    ? 'ml-auto bg-primary text-primary-foreground'
                    : 'bg-card text-foreground ring-1 ring-border',
                )}
              >
                {message.text}
              </div>
            ))
          )}
          {pending ? <p className="text-sm text-muted-foreground">Thinking…</p> : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div ref={bottomRef} />
        </div>

        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            void send(draft)
          }}
        >
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ask about water, crops, or weather"
            aria-label="Message to AquaFlow Assistant"
            disabled={pending}
            className="h-10"
          />
          <Button type="submit" disabled={pending || draft.trim() === ''} aria-label="Send message">
            <Send className="h-4 w-4" aria-hidden="true" />
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
