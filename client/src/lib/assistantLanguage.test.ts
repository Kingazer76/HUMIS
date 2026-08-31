import { beforeEach, describe, expect, it } from 'vitest'
import { ASSISTANT_LANGUAGE_STORAGE_KEY } from '@aquaflow/shared'
import { readStoredAssistantLanguage, storeAssistantLanguage } from './assistantLanguage'

const memory = new Map<string, string>()

const fakeStorage = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => {
    memory.set(key, value)
  },
  removeItem: (key: string) => {
    memory.delete(key)
  },
  clear: () => memory.clear(),
  key: () => null,
  get length() {
    return memory.size
  },
} satisfies Storage

describe('assistant language storage', () => {
  beforeEach(() => {
    memory.clear()
    Object.defineProperty(globalThis, 'localStorage', { value: fakeStorage, configurable: true })
  })

  it('defaults to English and remembers a Ghanaian choice as humis_language', () => {
    expect(readStoredAssistantLanguage()).toBe('eng')
    storeAssistantLanguage('twi')
    expect(memory.get(ASSISTANT_LANGUAGE_STORAGE_KEY)).toBe('twi')
    expect(readStoredAssistantLanguage()).toBe('twi')
    storeAssistantLanguage('eng')
    expect(readStoredAssistantLanguage()).toBe('eng')
  })
})
