import type { PointerEvent, RefObject } from 'react'
import { Mic } from '@/lib/icons'
import { cn } from '@/lib/utils'
import type { VoicePlantPhase } from '@/lib/voiceErrors'
import './VoicePlant.css'

interface VoicePlantProps {
  phase: VoicePlantPhase
  disabled?: boolean
  label: string
  onHoldStart: () => void
  onHoldEnd: () => void
  plantRef: RefObject<HTMLButtonElement | null>
}

/**
 * Hold-to-speak control. Water under the plant is AquaFlow's resource.
 * The plant is the crop being protected. The microphone stays visible
 * so a farmer always knows where to press.
 */
export function VoicePlant({ phase, disabled, label, onHoldStart, onHoldEnd, plantRef }: VoicePlantProps) {
  return (
    <button
      ref={plantRef}
      type="button"
      className={cn('voice-plant')}
      data-phase={phase}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={phase === 'listening'}
      onPointerDown={(event: PointerEvent<HTMLButtonElement>) => {
        if (event.button !== 0 || disabled) return
        event.preventDefault()
        try {
          event.currentTarget.setPointerCapture(event.pointerId)
        } catch {
          // Keyboard and some test events cannot capture a pointer.
        }
        onHoldStart()
      }}
      onPointerUp={onHoldEnd}
      onPointerCancel={onHoldEnd}
      onLostPointerCapture={onHoldEnd}
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if (event.repeat || disabled) return
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault()
          onHoldStart()
        }
      }}
      onKeyUp={(event) => {
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault()
          onHoldEnd()
        }
      }}
    >
      <svg className="voice-plant-svg" viewBox="0 0 96 112" aria-hidden="true">
        <ellipse className="voice-ripple voice-ripple-b" cx="48" cy="94" rx="32" ry="9" />
        <ellipse className="voice-ripple voice-ripple-a" cx="48" cy="94" rx="24" ry="7" />
        <ellipse className="voice-water-basin" cx="48" cy="97" rx="28" ry="8.5" />
        <ellipse className="voice-water-shine" cx="42" cy="95" rx="10" ry="2.6" />

        <circle className="voice-drop" cx="48" cy="88" r="2.4" />

        <g className="voice-stem-group">
          <path className="voice-stem" d="M48 88 C48 74 48 62 48 44" />
          <path
            className="voice-pulse"
            d="M48 84 C48 72 48 60 48 48"
            strokeDasharray="10 26"
          />
          <path
            className="voice-leaf voice-leaf-left"
            d="M47 62 C34 58 28 50 32 43 C40 46 46 52 47 62 Z"
          />
          <path
            className="voice-leaf voice-leaf-right"
            d="M49 58 C62 53 68 45 64 38 C56 42 50 48 49 58 Z"
          />
          <path
            className="voice-leaf voice-leaf-top"
            d="M48 46 C42 36 46 28 48 26 C50 28 54 36 48 46 Z"
          />
        </g>
      </svg>
      <span className="voice-mic">
        <Mic className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    </button>
  )
}
