export type QuestionDifficulty = 1 | 2 | 3

export type Question = {
  id: string
  text: string
  answers: [string, string, string, string]
  correctIndex: number
  difficulty: QuestionDifficulty
  tags: string[]
}

export type BoosterType = 'fiftyFifty' | 'pause' | 'insurance'

export type Boosters = {
  fiftyFifty: number
  pause: number
  insurance: number
}

export type Player = {
  id: string
  name: string
  score: number
  streak: number
  correctCount: number
  wrongCount: number
  boosters: Boosters
  usedBoostersThisGame: Boosters
  nextQuestionBonusMultiplier: number
  totalBoostersEarnedThisGame: number
}

export type Multiplier = 1 | 2 | 3

export type AnswerResult = {
  answerIndex: number
  timeMs: number
  isCorrect: boolean
  pointsEarned: number
  pointsLost: number
  wasFirstCorrect?: boolean
}

export type QuizMode = 'solo' | 'room'

export type GamePhase = 'setup' | 'room_setup' | 'question' | 'result' | 'mini_summary' | 'final'

export type TimerState = {
  totalSec: number
  leftSec: number
  running: boolean
}

export type RoundAnswers = Record<string, AnswerResult>

export type UIFlags = {
  fiftyFiftyHiddenIndices: number[]
  insuranceArmedByPlayerId?: string
  pauseUsedThisQuestionByPlayerId?: string
  pauseBonusSeconds?: number
}

export type GameState = {
  mode: QuizMode
  selectedTags: string[]
  players: Player[]
  currentPlayerIndex: number
  questionQueue: Question[]
  currentQuestionIndex: number
  timer: TimerState
  currentMultiplier: Multiplier | null
  round: RoundAnswers
  uiFlags: UIFlags
  phase: GamePhase
  questionStartTime: number
  totalQuestions: number
  questionsAnswered: number
  /** Время на ответ (сек): 30, 60 или 120 */
  timePerQuestionSec: number
}

export type QuizProgress = {
  dailyStreakCount: number
  lastPlayDate: string
  coins: number
  totalScore: number
}

export const LEAGUES = {
  novice: { min: 0, max: 999, label: 'Новичок' },
  confident: { min: 1000, max: 4999, label: 'Уверенный' },
  pro: { min: 5000, max: Infinity, label: 'Профи' },
} as const

export const TAGS = ['movies', 'general', 'finance', 'relationships', 'history', 'science', 'sport'] as const

export const TAG_LABELS: Record<(typeof TAGS)[number], string> = {
  movies: 'Кино',
  general: 'Общее',
  finance: 'Финансы',
  relationships: 'Отношения',
  history: 'История',
  science: 'Наука',
  sport: 'Спорт',
}

export const TAG_EMOJIS: Record<(typeof TAGS)[number], string> = {
  movies: '🎬',
  general: '🧠',
  finance: '💰',
  relationships: '💕',
  history: '📜',
  science: '🔬',
  sport: '⚽',
}

export const TAG_ICONS: Record<(typeof TAGS)[number], string> = {
  movies: 'cinema',
  general: 'brain',
  finance: 'money',
  relationships: 'heart',
  history: 'scroll',
  science: 'flask',
  sport: 'sport',
}

export type QuizTeamSlot = {
  name: string
  players: string[]
}
