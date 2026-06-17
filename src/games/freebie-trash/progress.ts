import type { CategoryProgress, CategoryProgressMap, FreebieCard } from './types'

const PROGRESS_STORAGE_KEY = 'freebie-trash:category-progress:v2'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function createFreshCategoryProgress(
  categoryId: string,
  cardCount: number,
): CategoryProgress {
  return {
    categoryId,
    remainingIndices: shuffle(Array.from({ length: cardCount }, (_, i) => i)),
    completed: false,
    playedTotal: 0,
  }
}

export function loadCategoryProgressMap(): CategoryProgressMap {
  try {
    const raw = localStorage.getItem(PROGRESS_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed !== 'object' || parsed === null) return {}
    const map: CategoryProgressMap = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (!value || typeof value !== 'object') continue
      const v = value as CategoryProgress
      if (
        typeof v.categoryId === 'string' &&
        Array.isArray(v.remainingIndices) &&
        typeof v.completed === 'boolean'
      ) {
        map[key] = {
          categoryId: v.categoryId,
          remainingIndices: v.remainingIndices.filter((n) => typeof n === 'number'),
          completed: v.completed,
          playedTotal: typeof v.playedTotal === 'number' ? v.playedTotal : 0,
        }
      }
    }
    return map
  } catch {
    return {}
  }
}

export function saveCategoryProgressMap(map: CategoryProgressMap): void {
  try {
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}

export function getCategoryProgress(
  map: CategoryProgressMap,
  categoryId: string,
  cardCount: number,
): CategoryProgress {
  return map[categoryId] ?? createFreshCategoryProgress(categoryId, cardCount)
}

export function playedInCategory(progress: CategoryProgress, totalCards: number): number {
  return totalCards - progress.remainingIndices.length
}

export function progressPercent(progress: CategoryProgress, totalCards: number): number {
  if (totalCards <= 0) return 0
  return Math.round((playedInCategory(progress, totalCards) / totalCards) * 100)
}

export function drawNextCard(
  cards: FreebieCard[],
  progress: CategoryProgress,
): { card: FreebieCard; progress: CategoryProgress } | null {
  if (cards.length === 0) return null

  let remaining = [...progress.remainingIndices]
  if (remaining.length === 0) {
    remaining = shuffle(Array.from({ length: cards.length }, (_, i) => i))
  }

  const [cardIndex, ...rest] = remaining
  const card = cards[cardIndex]
  if (!card) return null

  const next: CategoryProgress = {
    categoryId: progress.categoryId,
    remainingIndices: rest,
    completed: rest.length === 0,
    playedTotal: progress.playedTotal + 1,
  }

  return { card, progress: next }
}

export function resetCategoryProgress(categoryId: string, cardCount: number): CategoryProgress {
  return createFreshCategoryProgress(categoryId, cardCount)
}
