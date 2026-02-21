/**
 * Safe Telegram WebApp HapticFeedback helpers.
 * No-op when WebApp or HapticFeedback is unavailable.
 */

function getHaptic() {
  if (typeof window === 'undefined') return null
  const tg = (window as Window & { Telegram?: { WebApp?: { HapticFeedback?: unknown } } })?.Telegram?.WebApp
  return tg?.HapticFeedback ?? null
}

/** selectionChanged — use when user selects an item (e.g. mode, game tile). */
export function hapticSelection(): void {
  try {
    const h = getHaptic()
    if (h && typeof (h as { selectionChanged?: () => void }).selectionChanged === 'function') {
      (h as { selectionChanged: () => void }).selectionChanged()
    }
  } catch {
    // no-op
  }
}

/** impactOccurred — use on primary actions (e.g. "Начать раунд"). */
export function hapticImpact(style: 'light' | 'medium' | 'heavy' = 'light'): void {
  try {
    const h = getHaptic()
    if (h && typeof (h as { impactOccurred?: (s: string) => void }).impactOccurred === 'function') {
      (h as { impactOccurred: (s: 'light' | 'medium' | 'heavy') => void }).impactOccurred(style)
    }
  } catch {
    // no-op
  }
}

/** notificationOccurred('success') — use when user scores (e.g. "Угадали"). */
export function hapticSuccess(): void {
  try {
    const h = getHaptic() as { notificationOccurred?: (t: string) => void } | null
    if (h?.notificationOccurred) {
      h.notificationOccurred('success')
    } else {
      hapticImpact('medium')
    }
  } catch {
    hapticImpact('medium')
  }
}
