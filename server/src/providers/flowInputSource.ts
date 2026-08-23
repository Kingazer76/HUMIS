import type { FlowInputSource } from '@aquaflow/shared'

/**
 * There is no flow sensor on the initial hardware list, so every Water
 * In / Water Used figure is derived from configured source/zone rates and
 * how long they were active — never from tank-level delta (see Phase 1
 * correction). This is the single place that constant lives, so a future
 * real flow sensor can become the active `FlowInputSource` without any
 * other module changing.
 */
export const ACTIVE_FLOW_INPUT_SOURCE: FlowInputSource = 'configured-rate'
