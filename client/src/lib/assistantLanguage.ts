import {
  ASSISTANT_LANGUAGE_STORAGE_KEY,
  DEFAULT_ASSISTANT_LANGUAGE,
  resolveAssistantLanguage,
  type AssistantLanguageId,
} from '@aquaflow/shared'

function storage(): Storage | undefined {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}

export function readStoredAssistantLanguage(): AssistantLanguageId {
  return resolveAssistantLanguage(storage()?.getItem(ASSISTANT_LANGUAGE_STORAGE_KEY) ?? undefined)
}

export function storeAssistantLanguage(id: AssistantLanguageId): void {
  storage()?.setItem(ASSISTANT_LANGUAGE_STORAGE_KEY, id)
}
