import type { ModeId } from '../data/modes'
import {
  FREE_GAMES,
  FREE_DECKS,
  FREE_LIMIT_PER_DECK,
} from '../config/premium'
import { PREMIUM_ENABLED } from './premium'

/** Лимит бесплатных вопросов (реэкспорт для обратной совместимости). */
export const FREE_QUESTIONS_LIMIT = FREE_LIMIT_PER_DECK

/** Подписка активна. */
export function isPremiumActive(premium: boolean | undefined): boolean {
  return !!premium
}

/** Игра бесплатна полностью (например truth-dare). */
export function isGameFree(gameKey: string): boolean {
  return (FREE_GAMES as readonly string[]).includes(gameKey)
}

/** Колода бесплатна (15 вопросов). game="card" — карточная игра. */
export function isDeckFree(params: {
  game: 'card'
  mode: string
  deckId: string
}): boolean {
  return FREE_DECKS.some(
    (d) =>
      d.game === params.game &&
      d.mode === params.mode &&
      d.deckId === params.deckId
  )
}

/** Можно ли открыть вопрос с данным индексом (0-based).
 * premium -> true
 * deckIsFree -> index < 15
 * иначе false
 */
export function canAccessQuestionIndex(params: {
  deckIsFree: boolean
  isPremium: boolean
  index: number
}): boolean {
  if (params.isPremium) return true
  if (params.deckIsFree) return params.index < FREE_LIMIT_PER_DECK
  return false
}

/**
 * Показывать ли премиум-плашку.
 * Если PREMIUM_ENABLED = false, всё считается доступным.
 */
export function shouldShowPremiumOverlay(hasPremium: boolean): boolean {
  if (!PREMIUM_ENABLED) return false
  return !hasPremium
}

/** Режимы карточной игры, доступные бесплатно (для входа). */
const FREE_MODES = new Set<ModeId>(['couples', 'party'])

/** Игра заблокирована для пользователя без подписки. */
export function isGameLocked(gameId: string, hasPremium: boolean): boolean {
  if (!shouldShowPremiumOverlay(hasPremium)) return false
  return !isGameFree(gameId)
}

/** Режим карточной игры заблокирован. */
export function isModeLocked(modeId: ModeId, hasPremium: boolean): boolean {
  if (!shouldShowPremiumOverlay(hasPremium)) return false
  return !FREE_MODES.has(modeId)
}

/** Колода заблокирована (полностью, не по лимиту вопросов). */
export function isDeckLocked(
  modeId: ModeId,
  deckId: string,
  hasPremium: boolean
): boolean {
  if (!shouldShowPremiumOverlay(hasPremium)) return false
  if (FREE_MODES.has(modeId)) {
    return !isDeckFree({ game: 'card', mode: modeId, deckId })
  }
  return true
}

/** Вопрос за пределами бесплатного лимита (индекс 0-based, 15+ = платно). */
export function isQuestionBeyondFreeLimit(
  modeId: ModeId,
  deckId: string,
  questionIndex: number,
  hasPremium: boolean
): boolean {
  if (!shouldShowPremiumOverlay(hasPremium)) return false
  if (!isDeckFree({ game: 'card', mode: modeId, deckId })) return false
  return questionIndex >= FREE_LIMIT_PER_DECK
}

/** Избранное и просмотр избранного — по подписке. */
export function isFavoritesLocked(hasPremium: boolean): boolean {
  return shouldShowPremiumOverlay(hasPremium)
}
