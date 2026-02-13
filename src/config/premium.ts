/**
 * Каноничная конфигурация Premium/Free-доступа.
 * Источник deckId: src/data/decksIndex.ts
 */

export const PREMIUM_PLAN = {
  id: 'premium_3m',
  priceRub: 259,
  durationMonths: 3,
} as const

/** Лимит бесплатных вопросов в бесплатных колодах. */
export const FREE_LIMIT_PER_DECK = 15

/** Игры, доступные для входа без подписки. truth-dare — полностью; card — выбор режимов. */
export const FREE_GAMES = ['card', 'truth-dare'] as const

/** Бесплатные колоды карточной игры (по 15 вопросов).
 * game="card" — Карточная игра (src/pages/CardGameEntry.tsx, /card)
 * deckId из src/data/decksIndex.ts
 */
export const FREE_DECKS = [
  { game: 'card' as const, mode: 'couples' as const, deckId: 'aboutUs' },   // Реальность нашей пары
  { game: 'card' as const, mode: 'couples' as const, deckId: 'feelings' },  // Эмоциональный вайб
  { game: 'card' as const, mode: 'party' as const, deckId: 'mostLikely' },  // Самый вероятный
  { game: 'card' as const, mode: 'party' as const, deckId: 'factsAboutUs' }, // Факты про нас
] as const
