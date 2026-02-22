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
  skipNoShame: number
  rerollSameLevel: number
}

export type TDPlayer = {
  id: string
  name: string
  courage: number
  shame: number
  respect: number
  tokens: PlayerTokens
  streakCompleted: number
  currentLevel: CardLevel
}

export type VoteChoice = 'ok' | 'harder'

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

export const TAGS = ['party', 'couples', 'light', 'hard', '18plus'] as const

export const TAG_LABELS: Record<(typeof TAGS)[number], string> = {
  party: 'Вечеринка',
  couples: 'Пары',
  light: 'Лёгкое',
  hard: 'Жёсткое',
  '18plus': '18+',
}

export const TAG_EMOJIS: Record<(typeof TAGS)[number], string> = {
  party: '🎉',
  couples: '💕',
  light: '✨',
  hard: '🔥',
  '18plus': '🔞',
}
