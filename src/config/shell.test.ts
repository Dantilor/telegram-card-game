import { describe, expect, it, vi, afterEach } from 'vitest'
import { resolveApiBase } from '../lib/apiBase'

describe('WEB same-origin API base', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('allows empty API base for WEB shell (reverse proxy)', () => {
    expect(resolveApiBase({ VITE_GNH_SHELL: 'web' })).toBe('')
    expect(resolveApiBase({ MODE: 'web' })).toBe('')
  })

  it('still requires API base for Mini App shell', () => {
    expect(() => resolveApiBase({ VITE_GNH_SHELL: 'telegram' })).toThrow(/не задан/)
    expect(() => resolveApiBase({})).toThrow(/не задан/)
  })
})
