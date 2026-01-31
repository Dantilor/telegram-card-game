import type { ModeId } from './modes'

export type DeckIndexEntry = {
  id: string
  modeId: ModeId
  title: string
  isPremium: boolean
}

/**
 * Метаданные колод. Вопросы не дублируются — берутся из data/decks и questions/.
 * id совпадает с deckId в Play.tsx и getDeckFull().
 */
export const DECK_INDEX: DeckIndexEntry[] = [
  /* Режим "Для пары" — 3 существующие + 3 премиум-заглушки */
  { id: 'couples', modeId: 'couples', title: 'Пары', isPremium: false },
  { id: 'intimacy', modeId: 'couples', title: 'Близость', isPremium: false },
  { id: 'self', modeId: 'couples', title: 'Про себя', isPremium: false },
  { id: 'couples-premium-1', modeId: 'couples', title: 'Глубокие вопросы', isPremium: true },
  { id: 'couples-premium-2', modeId: 'couples', title: 'Романтика', isPremium: true },
  { id: 'couples-premium-3', modeId: 'couples', title: 'Доверие', isPremium: true },
  /* Режим "Для компании" */
  { id: 'party', modeId: 'party', title: 'Вечеринка', isPremium: false },
  { id: 'friends', modeId: 'party', title: 'Друзья', isPremium: false },
  { id: 'party-premium-1', modeId: 'party', title: 'Весёлая компания', isPremium: true },
  /* Режим "18+" — заглушки */
  { id: 'adult-premium-1', modeId: 'adult', title: 'Огонь', isPremium: true },
  { id: 'adult-premium-2', modeId: 'adult', title: 'Искра', isPremium: true },
  /* Режим "Лайт" — заглушка */
  { id: 'lite-premium-1', modeId: 'lite', title: 'Лёгкие вопросы', isPremium: true },
]

export function getDecksByMode(modeId: ModeId): DeckIndexEntry[] {
  return DECK_INDEX.filter((d) => d.modeId === modeId)
}

export function getDeckFromIndex(deckId: string): DeckIndexEntry | undefined {
  return DECK_INDEX.find((d) => d.id === deckId)
}
