import { FREE_COMICS } from '../config/premium'
import { PREMIUM_ENABLED } from '../utils/premium'

/** Комикс заблокирован для free user. Отдельно от isGameLocked. */
export function isComicLocked(seriesId: string, hasPremium: boolean): boolean {
  if (!PREMIUM_ENABLED || hasPremium) return false
  return !(FREE_COMICS as readonly string[]).includes(seriesId)
}
