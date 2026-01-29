export type CustomDeck = {
  id: string
  title: string
  description?: string
  questions: string[]
  createdAt: string
}

export type CustomDecksStorage = {
  decks: CustomDeck[]
}

const STORAGE_KEY = 'tcg_custom_decks'

const defaultStorage: CustomDecksStorage = { decks: [] }

export function loadCustomDecks(): CustomDecksStorage {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultStorage
    const data = JSON.parse(raw) as CustomDecksStorage
    if (!Array.isArray(data.decks)) return defaultStorage
    return data
  } catch {
    return defaultStorage
  }
}

export function saveCustomDecks(data: CustomDecksStorage): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // ignore
  }
}

export function getCustomDeck(id: string): CustomDeck | undefined {
  const { decks } = loadCustomDecks()
  return decks.find((d) => d.id === id)
}

export function createCustomDeckId(): string {
  return 'custom-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9)
}
