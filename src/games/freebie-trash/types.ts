export type FreebieChoice = 'take' | 'skip' | null

export type FreebieScreen = 'categories' | 'card'

export type FreebieCard = {
  id: string
  categoryId: string
  text: string
  question: string
}

export type FreebieCategory = {
  id: string
  title: string
  subtitle: string
  emoji: string
}

export type CategoryProgress = {
  categoryId: string
  remainingIndices: number[]
  completed: boolean
  playedTotal: number
}

export type CategoryProgressMap = Record<string, CategoryProgress>
