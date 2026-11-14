/**
 * Единый helper для проверки доступа free/premium.
 * Источник правды: decksIndex (freeLimit, isPremium).
 */

import { getDeckFromIndex, type DeckIndexEntry } from '../data/decksIndex'
import { PREMIUM_ENABLED } from '../utils/premium'
import { FREE_GAMES } from '../config/premium'
import type { ModeId } from '../data/modes'

export class AccessDeniedError extends Error {
  constructor(message = 'Access denied') {
    super(message)
    this.name = 'AccessDeniedError'
  }
}

/**
 * Можно ли открыть колоду (играть).
 * true = открыть (частично или полностью)
 * false = показать PremiumOverlay
 */
export function canOpenDeck(deck: DeckIndexEntry, premium: boolean): boolean {
  if (!PREMIUM_ENABLED) return true
  if (premium) return true
  if (deck.freeLimit != null && deck.freeLimit > 0) return true
  return !deck.isPremium
}

/**
 * Режимы карточной игры, доступные для входа (couples, party — в них есть free колоды).
 */
const FREE_MODES = new Set<ModeId>(['couples', 'party'])

/** Колода заблокирована для free user. */
export function isDeckLocked(
  modeId: ModeId,
  deckId: string,
  hasPremium: boolean
): boolean {
  if (!PREMIUM_ENABLED || hasPremium) return false
  if (!FREE_MODES.has(modeId)) return true
  const entry = getDeckFromIndex(deckId)
  if (!entry) return true
  return entry.isPremium && !entry.freeLimit
}

/** Вопрос за пределами freeLimit (индекс 0-based). */
export function isQuestionBeyondFreeLimit(
  _modeId: ModeId,
  deckId: string,
  questionIndex: number,
  hasPremium: boolean
): boolean {
  if (!PREMIUM_ENABLED || hasPremium) return false
  const entry = getDeckFromIndex(deckId)
  if (!entry?.freeLimit) return false
  return questionIndex >= entry.freeLimit
}

/** Игра заблокирована (card и truth-dare — free для входа). */
export function isGameLocked(gameId: string, hasPremium: boolean): boolean {
  if (!PREMIUM_ENABLED || hasPremium) return false
  return !(FREE_GAMES as readonly string[]).includes(gameId)
}

/** Избранное доступно только с Premium. */
export function isFavoritesLocked(hasPremium: boolean): boolean {
  if (!PREMIUM_ENABLED || hasPremium) return false
  return true
}

/** Темы — временно доступны всем (без Premium). */
export function isThemeLocked(_hasPremium: boolean): boolean {
  return false
}
