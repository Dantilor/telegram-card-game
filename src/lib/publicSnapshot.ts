/**
 * Small, public-only display cache for the Home screen.
 *
 * Never use this for identity, Premium access, payment amounts or consent.
 * Fresh server responses always replace the snapshot in the background.
 */
const PREFIX = 'gnh_home_public_v1:'

type Snapshot = { savedAt: number; value: unknown }

export function readPublicSnapshot<T>(
  key: 'user-count' | 'plans-label',
  maxAgeMs: number,
  validate: (value: unknown) => value is T,
): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (!raw) return null
    const item = JSON.parse(raw) as Snapshot
    if (
      typeof item.savedAt !== 'number' ||
      item.savedAt > Date.now() ||
      Date.now() - item.savedAt > maxAgeMs ||
      !validate(item.value)
    ) return null
    return item.value
  } catch {
    return null
  }
}

export function writePublicSnapshot(key: 'user-count' | 'plans-label', value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ savedAt: Date.now(), value }))
  } catch {
    // Storage may be disabled in Telegram's WebView.
  }
}

export function isPublicUserCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

export function isPublicPlansLabel(value: unknown): value is string {
  return typeof value === 'string' && /^от [0-9]{1,8} ₽$/.test(value)
}
