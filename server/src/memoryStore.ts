const store = new Map<number, { premiumUntil?: number }>()

export function getUser(telegramId: number): { premiumUntil?: number } | null {
  const entry = store.get(telegramId)
  return entry ?? null
}

export function setPremium(telegramId: number, premiumUntil: number): void {
  store.set(telegramId, { premiumUntil })
}

export function isPremium(telegramId: number): boolean {
  const entry = store.get(telegramId)
  if (!entry?.premiumUntil) return false
  return entry.premiumUntil > Date.now()
}
