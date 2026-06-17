const FAVORITES_STORAGE_KEY = 'freebie-trash:favorites'

export function loadFavoriteCardIds(): string[] {
  try {
    const raw = localStorage.getItem(FAVORITES_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((id): id is string => typeof id === 'string')
  } catch {
    return []
  }
}

export function saveFavoriteCardIds(ids: string[]): void {
  try {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(ids))
  } catch {
    /* ignore */
  }
}

export function toggleFavoriteCardId(cardId: string): string[] {
  const current = loadFavoriteCardIds()
  const next = current.includes(cardId)
    ? current.filter((id) => id !== cardId)
    : [...current, cardId]
  saveFavoriteCardIds(next)
  return next
}

export function isFavoriteCard(cardId: string): boolean {
  return loadFavoriteCardIds().includes(cardId)
}
