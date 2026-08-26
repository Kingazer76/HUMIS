import { useEffect, useRef, useState } from 'react'
import { MessageCircle, Mic, Send } from '@/lib/icons'
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
import { createSpeechPlayback } from '@/lib/playSpeech'
import { startSpeechRecording, type SpeechRecorder } from '@/lib/recordSpeech'
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

const RETRY = "I didn't catch that. Tap the microphone and try again."
const SPEAK_RETRY = "Couldn't speak that. The written answer is still on screen."

/**
 * Header chat for the AquaFlow Assistant. Typed messages and recognized
 * speech both go to `/api/assistant/chat` — the same Phase 7 path.
 * New assistant replies are then spoken through `/api/assistant/speak`.
 */
export function AssistantChat() {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState(false)
  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [speakError, setSpeakError] = useState<string | undefined>()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const nextId = useRef(1)
  const recorderRef = useRef<SpeechRecorder | null>(null)
  const finishingRef = useRef(false)
  const playbackRef = useRef(createSpeechPlayback())
  const speakGen = useRef(0)
  const speakAbortRef = useRef<AbortController | null>(null)
  const [lastReply, setLastReply] = useState<string | undefined>()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages, pending, listening, speaking])

  useEffect(() => {
    return () => {
      void recorderRef.current?.stop()
      speakGen.current += 1
      speakAbortRef.current?.abort()
      playbackRef.current.stop()
    }
  }, [])

  function stopSpeaking() {
    speakGen.current += 1
    speakAbortRef.current?.abort()
    speakAbortRef.current = null
    playbackRef.current.stop()
    setSpeaking(false)
  }

  async function speakReply(text: string) {
    setLastReply(text)
    stopSpeaking()
    const gen = speakGen.current
    const abort = new AbortController()
    speakAbortRef.current = abort
    setSpeakError(undefined)
    setSpeaking(true)
    try {
      const audio = await api.speakAssistantReply(text, abort.signal)
      if (gen !== speakGen.current) return
      await playbackRef.current.play(audio)
      if (gen !== speakGen.current) return
      setSpeaking(false)
    } catch (err) {
      if (abort.signal.aborted || gen !== speakGen.current) return
      const message = err instanceof Error && err.message.trim() ? err.message : SPEAK_RETRY
      setSpeakError(message)
      setSpeaking(false)
    }
  }

  async function send(text: string) {
    const message = text.trim()
    if (!message || pending) return

    stopSpeaking()
    const userMsg: ChatMessage = { id: nextId.current++, role: 'user', text: message }
    setMessages((current) => [...current, userMsg])
    setDraft('')
    setPending(true)
    setError(undefined)
    setSpeakError(undefined)

    try {
      const result = await api.sendAssistantMessage(message)
      setMessages((current) => [
        ...current,
        { id: nextId.current++, role: 'assistant', text: result.reply },
      ])
      setPending(false)
      void speakReply(result.reply)
    } catch {
      setError("Can't reach the AquaFlow server. Try again.")
      setPending(false)
    }
  }

  async function startListening() {
    if (pending || listening) return
    stopSpeaking()
    setError(undefined)
    setSpeakError(undefined)
    try {
      recorderRef.current = await startSpeechRecording()
      setListening(true)
    } catch (err) {
      const blocked = err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'NotFoundError')
      setError(
        blocked
          ? 'Microphone is blocked. Allow the microphone and try again.'
          : 'This browser cannot use the microphone. Type your question instead.',
      )
    }
  }

  async function finishListening() {
    if (finishingRef.current) return
    const recorder = recorderRef.current
    if (!recorder) {
      setListening(false)
      return
    }
    finishingRef.current = true
    recorderRef.current = null
    setListening(false)
    try {
      const wav = await recorder.stop()
      const spoken = await api.transcribeSpeech(wav)
      if (!spoken.ok || !spoken.text?.trim()) {
        setError(spoken.reason ?? RETRY)
        return
      }
      await send(spoken.text)
    } catch {
      setError(RETRY)
    } finally {
      finishingRef.current = false
    }
  }

  async function toggleListening() {
    if (listening) {
      await finishListening()
      return
    }
    await startListening()
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      void recorderRef.current?.stop()
      recorderRef.current = null
      setListening(false)
      stopSpeaking()
    }
  }

  const ready = messages.length > 0 && !pending && !listening && !speaking && !speakError

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
            Ask about your water, fields, or weather. Tap the microphone to speak. I use the same
            safety gate as the Irrigation buttons. New answers are read out loud.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-lg border border-border bg-muted/40 p-3">
          {messages.length === 0 && !pending && !listening ? (
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
          {listening ? <p className="text-sm font-medium text-primary">Listening…</p> : null}
          {pending ? <p className="text-sm text-muted-foreground">Thinking…</p> : null}
          {speaking ? (
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-primary">Speaking…</p>
              <Button type="button" variant="outline" size="sm" onClick={stopSpeaking}>
                Stop
              </Button>
            </div>
          ) : null}
          {ready ? <p className="text-sm text-muted-foreground">Ready</p> : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {speakError ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-destructive">{speakError}</p>
              {lastReply ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="self-start"
                  onClick={() => {
                    void speakReply(lastReply)
                  }}
                >
                  Try speaking again
                </Button>
              ) : null}
            </div>
          ) : null}
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
            disabled={pending || listening}
            className="h-10"
          />
          <Button
            type="button"
            variant={listening ? 'default' : 'outline'}
            size="icon"
            className="h-10 w-10 shrink-0"
            disabled={pending}
            aria-label={listening ? 'Listening. Tap to send.' : 'Tap to speak'}
            title={listening ? 'Listening…' : 'Tap to speak'}
            aria-pressed={listening}
            onClick={() => void toggleListening()}
          >
            <Mic className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button type="submit" disabled={pending || listening || draft.trim() === ''} aria-label="Send message">
            <Send className="h-4 w-4" aria-hidden="true" />
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
