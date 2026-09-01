import type { NextFunction, Request, Response } from 'express'
import { getHardwareKey } from '../env.js'

function readProvidedKey(req: Request): string {
  const header = req.header('x-humis-hardware-key')?.trim() ?? ''
  if (header) return header
  const query = req.query.key
  if (typeof query === 'string') return query.trim()
  if (Array.isArray(query) && typeof query[0] === 'string') return query[0].trim()
  const body = req.body as { key?: unknown } | undefined
  if (body && typeof body.key === 'string') return body.key.trim()
  return ''
}

/**
 * ESP32 / PictoBlox cannot sign in with a farmer cookie. Hardware routes
 * use a shared key instead. Farmer session cookies are not accepted here.
 */
export function requireHardwareKey(req: Request, res: Response, next: NextFunction): void {
  const expected = getHardwareKey()
  if (!expected) {
    res.status(503).json({
      ok: false,
      reason: 'Set HUMIS_HARDWARE_KEY in the server .env before the ESP32 can talk to HUMIS.',
    })
    return
  }
  const provided = readProvidedKey(req)
  if (!provided || provided !== expected) {
    res.status(401).json({ ok: false, reason: 'Hardware key is missing or wrong.' })
    return
  }
  next()
}
