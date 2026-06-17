import type { RussiaTravelCard } from '../../data/russiaTravel'

const PROGRESS_STORAGE_KEY = 'russia-travel:deck-progress:v1'

export type DeckProgress = {
  deckId: string
  remainingIndices: number[]
  completed: boolean
  playedTotal: number
}

export type DeckProgressMap = Record<string, DeckProgress>

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function createFreshDeckProgress(deckId: string, cardCount: number): DeckProgress {
  return {
    deckId,
    remainingIndices: shuffle(Array.from({ length: cardCount }, (_, i) => i)),
    completed: false,
    playedTotal: 0,
  }
}

export function loadDeckProgressMap(): DeckProgressMap {
  try {
    const raw = localStorage.getItem(PROGRESS_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed !== 'object' || parsed === null) return {}
    const map: DeckProgressMap = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (!value || typeof value !== 'object') continue
      const v = value as DeckProgress
      if (
        typeof v.deckId === 'string' &&
        Array.isArray(v.remainingIndices) &&
        typeof v.completed === 'boolean'
      ) {
        map[key] = {
          deckId: v.deckId,
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

export function saveDeckProgressMap(map: DeckProgressMap): void {
  try {
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}

export function getDeckProgress(
  map: DeckProgressMap,
  deckId: string,
  cardCount: number,
): DeckProgress {
  return map[deckId] ?? createFreshDeckProgress(deckId, cardCount)
}

export function playedInDeck(progress: DeckProgress, totalCards: number): number {
  return totalCards - progress.remainingIndices.length
}

export function drawNextCard(
  cards: RussiaTravelCard[],
  progress: DeckProgress,
): { card: RussiaTravelCard; progress: DeckProgress } | null {
  if (cards.length === 0) return null

  let remaining = [...progress.remainingIndices]
  if (remaining.length === 0) {
    remaining = shuffle(Array.from({ length: cards.length }, (_, i) => i))
  }

  const [cardIndex, ...rest] = remaining
  const card = cards[cardIndex]
  if (!card) return null

  return {
    card,
    progress: {
      deckId: progress.deckId,
      remainingIndices: rest,
      completed: rest.length === 0,
      playedTotal: progress.playedTotal + 1,
    },
  }
}

export function resetDeckProgress(deckId: string, cardCount: number): DeckProgress {
  return createFreshDeckProgress(deckId, cardCount)
}
