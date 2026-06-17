import { describe, expect, it, beforeEach, vi } from 'vitest'
import {
  loadMafiaSetupDraft,
  namesForForm,
  saveMafiaSetupDraft,
} from './setupStorage'

describe('mafia setupStorage', () => {
  beforeEach(() => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
    })
  })

  it('namesForForm strips default player labels', () => {
    expect(namesForForm(['Игрок 1', 'Аня', 'Игрок 3'], 3)).toEqual(['', 'Аня', ''])
  })

  it('save and load round-trips roster', () => {
    saveMafiaSetupDraft({
      playerCount: 5,
      hostName: 'Саша',
      playerNames: ['Аня', 'Боря', 'Вика', 'Гена', 'Дима'],
    })
    expect(loadMafiaSetupDraft()).toEqual({
      playerCount: 5,
      hostName: 'Саша',
      playerNames: ['Аня', 'Боря', 'Вика', 'Гена', 'Дима'],
    })
  })
})
