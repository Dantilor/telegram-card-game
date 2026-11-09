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

  it('joins same-origin WEB paths without /api/api duplication', () => {
    const base = resolveApiBase({ VITE_GNH_SHELL: 'web', VITE_API_URL: '', VITE_API_BASE: '' })
    expect(base).toBe('')
    expect(`${base}/api/me`).toBe('/api/me')
    expect(`${base}/api/web/session/me`).toBe('/api/web/session/me')
    expect(`${base}/api/games/sled/rooms`).toBe('/api/games/sled/rooms')
  })
})
