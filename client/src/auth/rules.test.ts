import { describe, expect, it } from 'vitest'
import { isValidEmail, passwordIssues, safeNextPath } from './rules'

describe('auth form rules', () => {
  it('checks email shape', () => {
    expect(isValidEmail('ama@farm.gh')).toBe(true)
    expect(isValidEmail('not-an-email')).toBe(false)
  })

  it('checks password strength in plain language', () => {
    expect(passwordIssues('FarmWater-92')).toEqual([])
    expect(passwordIssues('short')).toContain('Use at least 8 characters.')
  })

  it('blocks unsafe return paths', () => {
    expect(safeNextPath('/water')).toBe('/water')
    expect(safeNextPath('https://evil.example')).toBe('/overview')
    expect(safeNextPath('//evil.example')).toBe('/overview')
  })
})
