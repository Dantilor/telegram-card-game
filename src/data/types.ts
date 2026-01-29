import type { Deck } from './decks'

export type DeckFull = Deck & {
  questions: string[]
}

export type UserState = {
  premium: boolean
  progress: Record<string, { order: number[]; index: number }>
  favorites: Record<string, number[]>
}

export const defaultUserState: UserState = {
  premium: false,
  progress: {},
  favorites: {},
}
