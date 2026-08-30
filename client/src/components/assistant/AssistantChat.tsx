import { useEffect, useRef, useState } from 'react'
import { VOICE_MESSAGES, toFarmerVoiceMessage } from '@aquaflow/shared'
import { MessageCircle, Send } from '@/lib/icons'
import { VoicePlant } from '@/components/assistant/VoicePlant'
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
import { startSpeechRecording, wavBlobIsTooShort, type SpeechRecorder } from '@/lib/recordSpeech'
import {
  isNetworkFailure,
  microphoneErrorMessage,
  speakErrorMessage,
  voicePlantCaption,
  voicePlantPhase,
  voiceStatusLabel,
} from '@/lib/voiceErrors'
import { cn } from '@/lib/utils'

interface ChatMessage {
  id: number
  role: 'user' | 'assistant'
  text: string
  heard?: boolean
}

const SUGGESTIONS = [
  'How much water is in the tank?',
  'Do my crops need water?',
  'Start watering',
  'Stop watering',
]

const TRANSCRIBE_MS = 30_000

/**
 * Header chat for the AquaFlow Assistant. Typed messages and recognized
 * speech both go to `/api/assistant/chat` — the same farm-brain path.
 * Hold the plant to speak. New answers are then spoken through
 * `/api/assistant/speak`.
 */
export function AssistantChat() {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState(false)
  const [listening, setListening] = useState(false)
  const [understanding, setUnderstanding] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [speakError, setSpeakError] = useState<string | undefined>()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const plantRef = useRef<HTMLButtonElement>(null)
  const nextId = useRef(1)
  const recorderRef = useRef<SpeechRecorder | null>(null)
  const finishingRef = useRef(false)
  const holdingRef = useRef(false)
  const openRef = useRef(false)
  const listenGen = useRef(0)
  const playbackRef = useRef(createSpeechPlayback())
  const speakGen = useRef(0)
  const speakAbortRef = useRef<AbortController | null>(null)
  const transcribeAbortRef = useRef<AbortController | null>(null)
  const [lastReply, setLastReply] = useState<string | undefined>()

  useEffect(() => {
    openRef.current = open
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages, pending, listening, understanding, speaking])

  useEffect(() => {
    return () => {
      holdingRef.current = false
      listenGen.current += 1
      transcribeAbortRef.current?.abort()
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
      if (gen !== speakGen.current || !openRef.current) return
      await playbackRef.current.play(audio)
      if (gen !== speakGen.current) return
      setSpeaking(false)
    } catch (err) {
      if (abort.signal.aborted || gen !== speakGen.current) return
      setSpeakError(speakErrorMessage(err))
      setSpeaking(false)
    }
  }

  async function send(text: string, options?: { heard?: boolean }) {
    const message = text.trim()
    if (!message || pending) return

    stopSpeaking()
    const userMsg: ChatMessage = {
      id: nextId.current++,
      role: 'user',
      text: message,
      heard: options?.heard,
    }
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
      if (openRef.current) void speakReply(result.reply)
    } catch (err) {
      setError(isNetworkFailure(err) ? VOICE_MESSAGES.noInternet : VOICE_MESSAGES.chatUnreachable)
      setPending(false)
    }
  }

  async function startListening() {
    if (pending || listening || understanding || finishingRef.current) return
    stopSpeaking()
    setError(undefined)
    setSpeakError(undefined)
    listenGen.current += 1
    try {
      recorderRef.current = await startSpeechRecording({
        levelElement: plantRef.current,
        onAutoStop: () => {
          holdingRef.current = false
          void finishListening()
        },
      })
      if (!holdingRef.current) {
        await finishListening()
        return
      }
      setListening(true)
    } catch (err) {
      holdingRef.current = false
      setError(microphoneErrorMessage(err))
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
    const gen = listenGen.current
    recorderRef.current = null
    setListening(false)
    setUnderstanding(true)

    const abort = new AbortController()
    transcribeAbortRef.current?.abort()
    transcribeAbortRef.current = abort
    const timer = window.setTimeout(() => abort.abort(), TRANSCRIBE_MS)

    try {
      const wav = await recorder.stop()
      if (gen !== listenGen.current || !openRef.current) return
      if (wavBlobIsTooShort(wav)) {
        setError(VOICE_MESSAGES.couldNotHear)
        return
      }
      const spoken = await api.transcribeSpeech(wav, abort.signal)
      if (gen !== listenGen.current || !openRef.current) return
      if (!spoken.ok || !spoken.text?.trim()) {
        setError(toFarmerVoiceMessage(spoken.reason, VOICE_MESSAGES.couldNotUnderstand))
        return
      }
      setUnderstanding(false)
      await send(spoken.text, { heard: true })
    } catch (err) {
      if (gen !== listenGen.current || !openRef.current) return
      if (err instanceof Error && err.name === 'AbortError') {
        setError(VOICE_MESSAGES.generic)
        return
      }
      setError(isNetworkFailure(err) ? VOICE_MESSAGES.noInternet : VOICE_MESSAGES.couldNotUnderstand)
    } finally {
      window.clearTimeout(timer)
      if (transcribeAbortRef.current === abort) transcribeAbortRef.current = null
      if (gen === listenGen.current) setUnderstanding(false)
      finishingRef.current = false
    }
  }

  function beginHold() {
    if (pending || understanding || finishingRef.current) return
    holdingRef.current = true
    void startListening()
  }

  function endHold() {
    if (!holdingRef.current && !listening) return
    holdingRef.current = false
    void finishListening()
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      holdingRef.current = false
      listenGen.current += 1
      transcribeAbortRef.current?.abort()
      transcribeAbortRef.current = null
      void recorderRef.current?.stop()
      recorderRef.current = null
      finishingRef.current = false
      setListening(false)
      setUnderstanding(false)
      stopSpeaking()
    }
  }

  const busy = pending || listening || understanding
  const plantPhase = voicePlantPhase({ listening, understanding, pending, speaking })
  const plantLabel = voicePlantCaption(plantPhase)
  const status = voiceStatusLabel({ listening, understanding, pending, speaking })
  const ready = messages.length > 0 && !busy && !speaking && !speakError

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
        className="flex max-h-[min(40rem,90svh)] w-full flex-col gap-3 sm:max-w-lg"
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle>AquaFlow Assistant</DialogTitle>
          <DialogDescription>
            Ask about your water, fields, or weather. Hold the plant to speak. I use the same safety
            gate as the Irrigation buttons. New answers are read out loud.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-lg border border-border bg-muted/40 p-3">
          {messages.length === 0 && !pending && !listening && !understanding ? (
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
                {message.role === 'user' && message.heard ? (
                  <p className="mb-1 text-xs font-medium opacity-80">You said:</p>
                ) : null}
                {message.role === 'assistant' ? (
                  <p className="mb-1 text-xs font-medium text-muted-foreground">AquaFlow:</p>
                ) : null}
                {message.text}
              </div>
            ))
          )}
          {status ? (
            <p className="text-sm font-medium text-primary" aria-live="polite">
              {status}
            </p>
          ) : null}
          {ready ? <p className="text-sm text-muted-foreground">{VOICE_MESSAGES.ready}</p> : null}
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          {speaking ? (
            <Button type="button" variant="outline" size="sm" className="self-start" onClick={stopSpeaking}>
              Stop
            </Button>
          ) : null}
          {speakError ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-destructive" role="alert">
                {speakError}
              </p>
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

        <div className="flex flex-col items-center gap-1.5">
          <VoicePlant
            plantRef={plantRef}
            phase={plantPhase}
            disabled={pending || understanding}
            label={plantLabel}
            onHoldStart={beginHold}
            onHoldEnd={endHold}
          />
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {plantLabel}
          </p>
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
            disabled={busy}
            className="h-10"
          />
          <Button type="submit" disabled={busy || draft.trim() === ''} aria-label="Send message">
            <Send className="h-4 w-4" aria-hidden="true" />
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
