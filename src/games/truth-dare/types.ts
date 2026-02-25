export type CardType = 'truth' | 'dare'

export type CardLevel = 1 | 2 | 3 | 4

export type Card = {
  id: string
  type: CardType
  level: CardLevel
  text: string
  tags: string[]
  durationSec?: number
}

export type PlayerTokens = {
  rerollSameLevel: number
}

export type TDPlayer = {
  id: string
  name: string
  courage: number
  shame: number
  respect: number
  truthCounted: number
  dareCounted: number
  notCounted: number
  tokens: PlayerTokens
  streakCompleted: number
  currentLevel: CardLevel
}

export type VoteChoice = 'ok' | 'notCounted'

export type TDPhase = 'setup' | 'choice' | 'card' | 'vote' | 'result'

export type TDState = {
  players: TDPlayer[]
  currentPlayerIndex: number
  stepCount: number
  totalStepsTarget: number
  phase: TDPhase
  currentChoice: CardType | null
  currentCard: Card | null
  currentLevel: CardLevel
  forcedNoRefuse: boolean
  shameCardActive: boolean
  selectedTags: string[]
  usedCardIds: string[]
  vote: {
    enabled: boolean
    votes: Record<string, VoteChoice>
    result: VoteChoice | null
  }
}

export const TAGS = ['party', 'couples', 'light', 'hard', '18plus', 'intim'] as const

export const TAG_LABELS: Record<(typeof TAGS)[number], { main: string; sub: string }> = {
  party: { main: 'Лайт', sub: 'Компания' },
  couples: { main: 'Драйв', sub: 'Компания' },
  light: { main: 'Хардкор', sub: 'Компания' },
  hard: { main: '18+', sub: 'Компания' },
  '18plus': { main: 'Сближение', sub: 'Пара' },
  intim: { main: 'Страсть', sub: 'Пара' },
}

export const TAG_EMOJIS: Record<(typeof TAGS)[number], string> = {
  party: '✨',
  couples: '⚡',
  light: '💀',
  hard: '🔞',
  '18plus': '💕',
  intim: '❤️‍🔥',
}

export const TAG_ICONS: Record<(typeof TAGS)[number], string> = {
  party: 'party',
  couples: 'heart',
  light: 'sparkle',
  hard: 'fire',
  '18plus': 'adult',
  intim: 'heart',
}
