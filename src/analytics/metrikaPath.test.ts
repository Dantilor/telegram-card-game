import { describe, expect, it } from 'vitest'
import { gameIdFromPath, isGameOpenPath, normalizeMetrikaPath } from './metrikaPath'

describe('normalizeMetrikaPath', () => {
  it('strips tokens and sensitive query by dropping search entirely', () => {
    expect(normalizeMetrikaPath('/email/confirm', '?token=secret-value')).toBe('/email/confirm')
    expect(normalizeMetrikaPath('/link-web/extra', '?x=1')).toBe('/link-web')
    expect(normalizeMetrikaPath('/login', '?next=/profile&email=a@b.c')).toBe('/login')
  })

  it('keeps public and game routes without private tails', () => {
    expect(normalizeMetrikaPath('/')).toBe('/')
    expect(normalizeMetrikaPath('/games/')).toBe('/games')
    expect(normalizeMetrikaPath('/discover/mafiya-onlajn')).toBe('/discover/mafiya-onlajn')
    expect(normalizeMetrikaPath('/mafia/roles')).toBe('/mafia/roles')
    expect(normalizeMetrikaPath('/decks/custom/abc123')).toBe('/decks/custom')
  })

  it('detects game_open paths and game ids', () => {
    expect(isGameOpenPath('/quiz')).toBe(true)
    expect(isGameOpenPath('/games')).toBe(false)
    expect(isGameOpenPath('/favorites')).toBe(false)
    expect(isGameOpenPath('/comics')).toBe(false)
    expect(gameIdFromPath('/mafia-shadows')).toBe('mafia-shadows')
    expect(gameIdFromPath('/play')).toBe('card')
  })
})