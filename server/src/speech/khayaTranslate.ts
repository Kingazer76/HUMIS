import { getKhayaApiKey } from '../env.js'

const DEFAULT_URL = 'https://translation-api.ghananlp.org/v2/translate'

/**
 * Khaya translation v2. Used only to carry farmer words to/from English
 * so the existing HUMIS farm brain can keep using parseIntent.
 * Keys stay on the server. This does not decide watering.
 */
export async function translateWithKhaya(
  text: string,
  pair: string,
  options?: { translateUrl?: string },
): Promise<string | undefined> {
  const trimmed = text.trim()
  const lang = pair.trim()
  if (!trimmed || !lang) return undefined

  const key = getKhayaApiKey()
  if (!key) return undefined

  const url = options?.translateUrl?.trim() || DEFAULT_URL
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ in: trimmed, lang }),
    })
    if (!res.ok) return undefined
    return extractTranslation(await res.json())
  } catch {
    return undefined
  }
}

function extractTranslation(body: unknown): string | undefined {
  if (typeof body === 'string') {
    const text = body.trim()
    return text.length > 0 ? text : undefined
  }
  if (body && typeof body === 'object' && 'text' in body) {
    const value = (body as { text?: unknown }).text
    if (typeof value === 'string') {
      const text = value.trim()
      return text.length > 0 ? text : undefined
    }
  }
  return undefined
}
