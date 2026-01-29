import { useState, useCallback, useEffect } from 'react'
import {
  loadCustomDecks,
  saveCustomDecks,
  createCustomDeckId,
  type CustomDeck,
  type CustomDecksStorage,
} from '../data/customDecks'

export function useCustomDecks(): {
  decks: CustomDeck[]
  addDeck: (deck: Omit<CustomDeck, 'id' | 'createdAt'>) => CustomDeck
  updateDeck: (id: string, updates: Partial<Pick<CustomDeck, 'title' | 'description' | 'questions'>>) => void
  removeDeck: (id: string) => void
  getDeck: (id: string) => CustomDeck | undefined
} {
  const [data, setData] = useState<CustomDecksStorage>(loadCustomDecks)

  useEffect(() => {
    saveCustomDecks(data)
  }, [data])

  const addDeck = useCallback((deck: Omit<CustomDeck, 'id' | 'createdAt'>): CustomDeck => {
    const newDeck: CustomDeck = {
      ...deck,
      id: createCustomDeckId(),
      createdAt: new Date().toISOString(),
      questions: deck.questions ?? [],
    }
    setData((prev) => ({ decks: [...prev.decks, newDeck] }))
    return newDeck
  }, [])

  const updateDeck = useCallback(
    (id: string, updates: Partial<Pick<CustomDeck, 'title' | 'description' | 'questions'>>) => {
      setData((prev) => ({
        decks: prev.decks.map((d) => (d.id === id ? { ...d, ...updates } : d)),
      }))
    },
    []
  )

  const removeDeck = useCallback((id: string) => {
    setData((prev) => ({ decks: prev.decks.filter((d) => d.id !== id) }))
  }, [])

  const getDeck = useCallback(
    (id: string) => data.decks.find((d) => d.id === id),
    [data.decks]
  )

  return { decks: data.decks, addDeck, updateDeck, removeDeck, getDeck }
}
