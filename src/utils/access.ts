/**
 * Re-exports from lib/access + legacy helpers.
 * Источник правды: lib/access (decksIndex с freeLimit).
 */

import type { ModeId } from '../data/modes'
import { FREE_LIMIT_PER_DECK } from '../config/premium'
import {
  isDeckLocked,
  isGameLocked,
  isQuestionBeyondFreeLimit,
  isFavoritesLocked,
} from '../lib/access'
import { getDeckFromIndex } from '../data/decksIndex'

export const FREE_QUESTIONS_LIMIT = FREE_LIMIT_PER_DECK

export function isPremiumActive(premium: boolean | undefined): boolean {
  return !!premium
}

export { isGameLocked, isDeckLocked, isQuestionBeyondFreeLimit, isFavoritesLocked }

/** Режимы карточной игры, доступные бесплатно. */
const FREE_MODES = new Set<ModeId>(['couples', 'party'])

/** Режим карточной игры заблокирован. */
export function isModeLocked(modeId: ModeId, hasPremium: boolean): boolean {
  if (hasPremium) return false
  return !FREE_MODES.has(modeId)
}

/** @deprecated Use decksIndex freeLimit */
export function isDeckFree(params: {
  game: 'card'
  mode: string
  deckId: string
}): boolean {
  const entry = getDeckFromIndex(params.deckId)
  return !!(entry?.freeLimit && entry.freeLimit > 0)
}

/** @deprecated Use lib/access.isQuestionBeyondFreeLimit */
export function canAccessQuestionIndex(params: {
  deckIsFree: boolean
  isPremium: boolean
  index: number
}): boolean {
  if (params.isPremium) return true
  if (params.deckIsFree) return params.index < FREE_LIMIT_PER_DECK
  return false
}

export function shouldShowPremiumOverlay(hasPremium: boolean): boolean {
  return isFavoritesLocked(hasPremium)
}
