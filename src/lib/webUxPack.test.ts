import { describe, expect, it } from 'vitest'
import { sanitizeWebDisplayName } from './webDisplayName'
import { isGameplayPath, isDismissedRecently } from './webInstall'

describe('web UX pack helpers', () => {
  it('sanitizeWebDisplayName strips controls and limits length', () => {
    expect(sanitizeWebDisplayName('  Анна\u0000  ')).toBe('Анна')
    expect(sanitizeWebDisplayName('a'.repeat(100)).length).toBe(40)
  })

  it('isGameplayPath hides install UI on immersive game and kit surfaces', () => {
    expect(isGameplayPath('/profile')).toBe(false)
    expect(isGameplayPath('/games')).toBe(false)
    expect(isGameplayPath('/comics')).toBe(false)
    expect(isGameplayPath('/play/deck-1')).toBe(true)
    expect(isGameplayPath('/alias/play')).toBe(true)
    expect(isGameplayPath('/sled')).toBe(true)
    // Premium / Wheel kit pages also suppress install chrome (no bottom strip).
    expect(isGameplayPath('/premium')).toBe(true)
    expect(isGameplayPath('/wheel')).toBe(true)
  })

  it('isDismissedRecently reads future timestamp', () => {
    const key = 'gnh_web_install_dismiss_until_v1'
    const now = Date.now()
    const store: Record<string, string> = { [key]: String(now + 60_000) }
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem(k: string) { return store[k] ?? null },
        setItem(k: string, v: string) { store[k] = String(v) },
        removeItem(k: string) { delete store[k] },
      },
    })
    expect(isDismissedRecently(now)).toBe(true)
    expect(isDismissedRecently(now + 120_000)).toBe(false)
  })
})