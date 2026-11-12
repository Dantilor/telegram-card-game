/**
 * Questions of a deck with the premium/freeLimit rules applied.
 * Kept apart from lib/access so screens that only check locks (Home, Games)
 * do not pull every question deck into the startup bundle.
 */

import { getDeckFromIndex } from '../data/decksIndex'
import { getDeckFull } from '../data/decks'
import { PREMIUM_ENABLED } from '../utils/premium'

/**
 * Возвращает массив вопросов с учётом premium и freeLimit.
 * - premium → все вопросы
 * - deck имеет freeLimit → slice(0, freeLimit)
 * - deck isPremium и !premium → [] (UI покажет paywall)
 */
export function getDeckQuestions(
  deckId: string,
  opts: { premium: boolean }
): string[] {
  const full = getDeckFull(deckId)
  const questions = full?.questions ?? []
  if (!questions.length) return []

  if (opts.premium || !PREMIUM_ENABLED) return [...questions]

  const entry = getDeckFromIndex(deckId)
  if (!entry) return []

  if (entry.freeLimit != null && entry.freeLimit > 0) {
    return questions.slice(0, entry.freeLimit)
  }
  if (entry.isPremium) {
    return []
  }
  return [...questions]
}
