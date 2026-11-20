/**
 * Каноничная конфигурация Premium/Free-доступа.
 * Цены и сроки тарифов — только из /api/plans (Supabase plans).
 */

/** Telegram Mini App plan IDs (unchanged). */
export const PREMIUM_PLAN_IDS = {
  month: 'premium_1m',
  quarter: 'premium_3m',
  lifetime: 'premium_lifetime',
} as const

/** WEB-only plan IDs (audience=web). Do not use in Telegram checkout. */
export const WEB_PREMIUM_PLAN_IDS = {
  month: 'premium_web_1m',
  quarter: 'premium_web_3m',
  lifetime: 'premium_web_lifetime',
} as const

export const DEFAULT_PREMIUM_PLAN_ID = PREMIUM_PLAN_IDS.quarter
export const DEFAULT_WEB_PREMIUM_PLAN_ID = WEB_PREMIUM_PLAN_IDS.quarter

/** @deprecated Используйте /api/plans; оставлено для совместимости типов */
export const PREMIUM_PLAN = {
  id: DEFAULT_PREMIUM_PLAN_ID,
} as const

/** Лимит бесплатных вопросов в бесплатных колодах. */
export const FREE_LIMIT_PER_DECK = 15

/** Игры, доступные для входа без подписки. */
export const FREE_GAMES = [
  'card',
  'quiz',
  'sled',
  'mafia-shadows',
  'doubles',
  'infected',
] as const

/** Комиксы, доступные без подписки (отдельно от FREE_GAMES). */
export const FREE_COMICS = ['series-1', 'series-2', 'series-3'] as const

/**
 * Откат premium (было до временного снятия 2026-06-15):
 * FREE_GAMES = ['card', 'truth-dare', 'mafia', 'alias'] as const
 */

/** Бесплатные колоды карточной игры (по 15 вопросов). */
export const FREE_DECKS = [
  { game: 'card' as const, mode: 'couples' as const, deckId: 'aboutUs' },
  { game: 'card' as const, mode: 'couples' as const, deckId: 'feelings' },
  { game: 'card' as const, mode: 'party' as const, deckId: 'mostLikely' },
  { game: 'card' as const, mode: 'party' as const, deckId: 'factsAboutUs' },
] as const