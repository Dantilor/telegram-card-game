import {
  createContext,
  useContext,
  useReducer,
  type ReactNode,
} from 'react'
import type { GameState, Player, Multiplier, RoundAnswers } from './types'
import { getQuestionsByTags, shuffleQuestions } from './data/questions'
import { calculatePoints, getFiftyFiftyIndices, getRandomBooster } from './gameEngine'

type QuizAction =
  | { type: 'START_SOLO'; tags: string[]; totalQuestions: number; timePerQuestionSec?: number }
  | { type: 'START_ROOM'; tags: string[]; totalQuestions: number; timePerQuestionSec: number }
  | { type: 'SET_ROOM_PLAYERS'; names: string[] }
  | { type: 'SELECT_BET'; multiplier: Multiplier }
  | { type: 'USE_FIFTY_FIFTY' }
  | { type: 'USE_PAUSE' }
  | { type: 'USE_INSURANCE' }
  | { type: 'ANSWER'; playerId: string; answerIndex: number; timeMs: number }
  | { type: 'TIMER_TICK'; leftSec: number; playerId: string }
  | { type: 'TIMER_TIMEOUT'; playerId: string }
  | { type: 'NEXT_QUESTION' }
  | { type: 'REVENGE' }
  | { type: 'CONTINUE_5' }
  | { type: 'RESET' }

function createPlayer(id: string, name: string): Player {
  return {
    id,
    name,
    score: 0,
    streak: 0,
    correctCount: 0,
    wrongCount: 0,
    boosters: { fiftyFifty: 0, pause: 0, insurance: 0 },
    usedBoostersThisGame: { fiftyFifty: 0, pause: 0, insurance: 0 },
    nextQuestionBonusMultiplier: 1,
    totalBoostersEarnedThisGame: 0,
  }
}

function applyStreakBonus(player: Player, isCorrect: boolean): Player {
  if (isCorrect) {
    const newStreak = player.streak + 1
    let nextBonus = player.nextQuestionBonusMultiplier
    let boosters = { ...player.boosters }
    let totalBoosters = player.totalBoostersEarnedThisGame
    if (newStreak === 3) nextBonus = 1.2
    if (newStreak === 5 && totalBoosters < 2) {
      const b = getRandomBooster()
      boosters = { ...boosters, [b]: boosters[b] + 1 }
      totalBoosters++
    }
    return { ...player, streak: newStreak, nextQuestionBonusMultiplier: nextBonus, boosters, totalBoostersEarnedThisGame: totalBoosters }
  }
  return { ...player, streak: 0, nextQuestionBonusMultiplier: 1 }
}

const DEFAULT_TIME_SEC = 60

function createTimer(sec: number) {
  return { totalSec: sec, leftSec: sec, running: false }
}

function createDefaultUiFlags(): GameState['uiFlags'] {
  return { fiftyFiftyHiddenIndices: [], pauseBonusSeconds: 0 }
}

function isActiveTurnPlayer(state: GameState, playerId: string): boolean {
  return state.players[state.currentPlayerIndex]?.id === playerId
}

function quizReducer(state: GameState, action: QuizAction): GameState {
  switch (action.type) {
    case 'START_SOLO': {
      const questions = getQuestionsByTags(action.tags, action.totalQuestions)
      if (questions.length < action.totalQuestions) {
        return state
      }
      const timeSec = action.timePerQuestionSec ?? DEFAULT_TIME_SEC
      const q = shuffleQuestions(questions).slice(0, action.totalQuestions)
      const player = createPlayer('solo-1', 'Игрок')
      return {
        mode: 'solo',
        selectedTags: action.tags,
        players: [player],
        currentPlayerIndex: 0,
        questionQueue: q,
        currentQuestionIndex: 0,
        timer: createTimer(timeSec),
        currentMultiplier: null,
        round: {},
        uiFlags: { fiftyFiftyHiddenIndices: [], pauseBonusSeconds: 0 },
        phase: 'question',
        questionStartTime: Date.now(),
        totalQuestions: action.totalQuestions,
        questionsAnswered: 0,
        timePerQuestionSec: timeSec,
      }
    }
    case 'START_ROOM': {
      return {
        ...state,
        mode: 'room',
        selectedTags: action.tags,
        phase: 'room_setup',
        questionQueue: [],
        totalQuestions: action.totalQuestions,
        timePerQuestionSec: action.timePerQuestionSec,
      }
    }
    case 'SET_ROOM_PLAYERS': {
      const pool = getQuestionsByTags(state.selectedTags, state.totalQuestions)
      if (pool.length < state.totalQuestions) return state
      const timeSec = state.timePerQuestionSec ?? DEFAULT_TIME_SEC
      const q = shuffleQuestions(pool).slice(0, state.totalQuestions)
      const players = action.names.map((name, i) => createPlayer(`p-${i}-${Date.now()}`, name))
      return {
        ...state,
        players,
        questionQueue: q,
        currentQuestionIndex: 0,
        timer: createTimer(timeSec),
        currentMultiplier: null,
        round: {},
        uiFlags: { fiftyFiftyHiddenIndices: [], pauseBonusSeconds: 0 },
        phase: 'question',
        questionStartTime: Date.now(),
        questionsAnswered: 0,
      }
    }
    case 'SELECT_BET':
      return { ...state, currentMultiplier: action.multiplier }
    case 'USE_FIFTY_FIFTY': {
      const cur = state.questionQueue[state.currentQuestionIndex]
      if (!cur) return state
      const pid = state.players[state.currentPlayerIndex]?.id
      const player = pid ? state.players.find((p) => p.id === pid) : null
      if (!player || player.boosters.fiftyFifty <= player.usedBoostersThisGame.fiftyFifty) return state
      const indices = getFiftyFiftyIndices(cur.correctIndex)
      return {
        ...state,
        uiFlags: { ...state.uiFlags, fiftyFiftyHiddenIndices: indices },
        players: state.players.map((p) =>
          p.id === pid
            ? {
                ...p,
                usedBoostersThisGame: { ...p.usedBoostersThisGame, fiftyFifty: p.usedBoostersThisGame.fiftyFifty + 1 },
              }
            : p
        ),
      }
    }
    case 'USE_PAUSE': {
      const pid = state.players[state.currentPlayerIndex]?.id
      const player = pid ? state.players.find((p) => p.id === pid) : null
      if (!player || player.boosters.pause <= player.usedBoostersThisGame.pause) return state
      return {
        ...state,
        timer: { ...state.timer, leftSec: Math.min(25, state.timer.leftSec + 10) },
        uiFlags: { ...state.uiFlags, pauseUsedThisQuestionByPlayerId: pid, pauseBonusSeconds: (state.uiFlags.pauseBonusSeconds ?? 0) + 10 },
        players: state.players.map((p) =>
          p.id === pid
            ? { ...p, usedBoostersThisGame: { ...p.usedBoostersThisGame, pause: p.usedBoostersThisGame.pause + 1 } }
            : p
        ),
      }
    }
    case 'USE_INSURANCE': {
      const pid = state.players[state.currentPlayerIndex]?.id
      const player = pid ? state.players.find((p) => p.id === pid) : null
      if (!player || player.boosters.insurance <= player.usedBoostersThisGame.insurance) return state
      return {
        ...state,
        uiFlags: { ...state.uiFlags, insuranceArmedByPlayerId: pid },
        players: state.players.map((p) =>
          p.id === pid
            ? {
                ...p,
                usedBoostersThisGame: { ...p.usedBoostersThisGame, insurance: p.usedBoostersThisGame.insurance + 1 },
              }
            : p
        ),
      }
    }
    case 'ANSWER': {
      // In room mode, record answer. Move to next player or result.
      if (state.mode === 'room') {
        const cur = state.questionQueue[state.currentQuestionIndex]
        if (!cur) return state
        if (!isActiveTurnPlayer(state, action.playerId)) return state
        if (state.round[action.playerId]) return state
        const mult = state.currentMultiplier ?? 1
        const player = state.players.find((p) => p.id === action.playerId)
        if (!player) return state
        const isCorrect = action.answerIndex === cur.correctIndex
        const insurance = state.uiFlags.insuranceArmedByPlayerId === action.playerId
        const streakBonus = player.nextQuestionBonusMultiplier > 1
        const firstCorrect = !Object.values(state.round).some((r) => r.isCorrect)
        const { earned, lost } = calculatePoints(cur, mult, isCorrect, {
          streakBonus,
          speedBonus: isCorrect && firstCorrect,
          insurance: !isCorrect && insurance,
        })
        let newPlayers = state.players.map((p) => {
          if (p.id !== action.playerId) return p
          const updated = { ...p, score: p.score + earned - lost }
          return applyStreakBonus(updated, isCorrect)
        })
        const round: RoundAnswers = {
          ...state.round,
          [action.playerId]: {
            answerIndex: action.answerIndex,
            timeMs: action.timeMs,
            isCorrect,
            pointsEarned: earned,
            pointsLost: lost,
            wasFirstCorrect: isCorrect && firstCorrect,
          },
        }
        const allAnswered = state.players.every((p) => round[p.id])
        if (allAnswered) {
          newPlayers = newPlayers.map((p) => {
            const r = round[p.id]
            if (!r) return p
            return {
              ...p,
              correctCount: p.correctCount + (r.isCorrect ? 1 : 0),
              wrongCount: p.wrongCount + (r.isCorrect ? 0 : 1),
            }
          })
        }
        const nextIdx = state.currentPlayerIndex + 1
        return {
          ...state,
          round,
          players: newPlayers,
          timer: allAnswered ? { ...state.timer, running: false } : createTimer(state.timePerQuestionSec ?? DEFAULT_TIME_SEC),
          phase: allAnswered ? 'result' : 'question',
          currentPlayerIndex: allAnswered ? state.currentPlayerIndex : nextIdx,
          currentMultiplier: allAnswered ? state.currentMultiplier : 1,
          uiFlags: allAnswered ? state.uiFlags : createDefaultUiFlags(),
          questionStartTime: allAnswered ? state.questionStartTime : Date.now(),
        }
      }
      // Solo branch
      const cur = state.questionQueue[state.currentQuestionIndex]
      if (!cur) return state
      if (!isActiveTurnPlayer(state, action.playerId)) return state
      if (state.round[action.playerId]) return state
      const mult = state.currentMultiplier ?? 1
      const player = state.players.find((p) => p.id === action.playerId)
      if (!player) return state
      const isCorrect = action.answerIndex === cur.correctIndex
      const insurance = state.uiFlags.insuranceArmedByPlayerId === action.playerId
      const streakBonus = player.nextQuestionBonusMultiplier > 1
      const { earned, lost } = calculatePoints(cur, mult, isCorrect, {
        streakBonus,
        speedBonus: false,
        insurance: !isCorrect && insurance,
      })
      let newPlayers = state.players.map((p) => {
        if (p.id !== action.playerId) return p
        const updated = { ...p, score: p.score + earned - lost }
        return applyStreakBonus(updated, isCorrect)
      })
      const round: RoundAnswers = {
        ...state.round,
        [action.playerId]: {
          answerIndex: action.answerIndex,
          timeMs: action.timeMs,
          isCorrect,
          pointsEarned: earned,
          pointsLost: lost,
          wasFirstCorrect: false,
        },
      }
      newPlayers = newPlayers.map((p) => {
        const r = round[p.id]
        if (!r) return p
        return {
          ...p,
          correctCount: p.correctCount + (r.isCorrect ? 1 : 0),
          wrongCount: p.wrongCount + (r.isCorrect ? 0 : 1),
        }
      })
      return {
        ...state,
        round,
        players: newPlayers,
        timer: { ...state.timer, running: false },
        phase: 'result',
      }
    }
    case 'TIMER_TICK': {
      if (!isActiveTurnPlayer(state, action.playerId)) return state
      return { ...state, timer: { ...state.timer, leftSec: action.leftSec } }
    }
    case 'TIMER_TIMEOUT': {
      const cur = state.questionQueue[state.currentQuestionIndex]
      if (!cur) return state
      if (!isActiveTurnPlayer(state, action.playerId)) return state
      if (state.round[action.playerId]) return state
      const mult = state.currentMultiplier ?? 1
      const currentPlayer = state.players.find((p) => p.id === action.playerId)
      if (!currentPlayer) return state
      const insurance = state.uiFlags.insuranceArmedByPlayerId === currentPlayer.id
      const { lost } = calculatePoints(cur, mult, false, { insurance })
      const updated = applyStreakBonus(
        {
          ...currentPlayer,
          score: currentPlayer.score - lost,
          wrongCount: currentPlayer.wrongCount + 1,
        },
        false
      )
      const round: RoundAnswers = {
        ...state.round,
        [currentPlayer.id]: { answerIndex: -1, timeMs: 0, isCorrect: false, pointsEarned: 0, pointsLost: lost },
      }
      if (state.mode === 'solo') {
        return {
          ...state,
          round,
          players: [updated],
          timer: { ...state.timer, running: false },
          phase: 'result',
        }
      }
      let newPlayers = state.players.map((p) => (p.id === currentPlayer.id ? updated : p))
      const allAnswered = state.players.every((p) => round[p.id])
      if (allAnswered) {
        newPlayers = newPlayers.map((p) => {
          const r = round[p.id]
          if (!r) return p
          return {
            ...p,
            correctCount: p.correctCount + (r.isCorrect ? 1 : 0),
            wrongCount: p.wrongCount + (r.isCorrect ? 0 : 1),
          }
        })
      }
      const nextIdx = state.currentPlayerIndex + 1
      return {
        ...state,
        round,
        players: newPlayers,
        timer: allAnswered ? { ...state.timer, running: false } : createTimer(state.timePerQuestionSec ?? DEFAULT_TIME_SEC),
        phase: allAnswered ? 'result' : 'question',
        currentPlayerIndex: allAnswered ? state.currentPlayerIndex : nextIdx,
        currentMultiplier: allAnswered ? state.currentMultiplier : 1,
        uiFlags: allAnswered ? state.uiFlags : createDefaultUiFlags(),
        questionStartTime: allAnswered ? state.questionStartTime : Date.now(),
      }
    }
    case 'NEXT_QUESTION': {
      const nextIdx = state.currentQuestionIndex + 1
      const questionsAnswered = state.questionsAnswered + 1
      if (nextIdx >= state.questionQueue.length) {
        return { ...state, phase: 'final', questionsAnswered }
      }
      const hasMoreQuestions = nextIdx < state.questionQueue.length
      if (state.mode === 'room' && hasMoreQuestions && questionsAnswered > 0 && questionsAnswered % 5 === 0) {
        return { ...state, phase: 'mini_summary', questionsAnswered }
      }
      return {
        ...state,
        currentQuestionIndex: nextIdx,
        currentPlayerIndex: 0,
        currentMultiplier: null,
        round: {},
        uiFlags: { fiftyFiftyHiddenIndices: [], pauseBonusSeconds: 0 },
        phase: 'question',
        questionStartTime: Date.now(),
        timer: createTimer(state.timePerQuestionSec ?? DEFAULT_TIME_SEC),
        questionsAnswered,
      }
    }
    case 'REVENGE': {
      const players = state.players.map((p) => ({
        ...p,
        score: 0,
        streak: 0,
        correctCount: 0,
        wrongCount: 0,
        usedBoostersThisGame: { fiftyFifty: 0, pause: 0, insurance: 0 } as const,
        nextQuestionBonusMultiplier: 1,
      }))
      const pool = getQuestionsByTags(state.selectedTags, state.totalQuestions)
      const q = shuffleQuestions(pool).slice(0, state.totalQuestions)
      if (q.length < state.totalQuestions) return state
      return {
        ...state,
        players,
        questionQueue: q,
        currentQuestionIndex: 0,
        currentMultiplier: null,
        round: {},
        uiFlags: { fiftyFiftyHiddenIndices: [], pauseBonusSeconds: 0 },
        phase: 'question',
        questionStartTime: Date.now(),
        timer: createTimer(state.timePerQuestionSec ?? DEFAULT_TIME_SEC),
        questionsAnswered: 0,
      }
    }
    case 'CONTINUE_5': {
      const nextIdx = state.currentQuestionIndex + 1
      if (nextIdx >= state.questionQueue.length) {
        return { ...state, phase: 'final' }
      }
      return {
        ...state,
        phase: 'question',
        currentQuestionIndex: nextIdx,
        currentPlayerIndex: 0,
        currentMultiplier: null,
        round: {},
        uiFlags: { fiftyFiftyHiddenIndices: [], pauseBonusSeconds: 0 },
        questionStartTime: Date.now(),
        timer: createTimer(state.timePerQuestionSec ?? DEFAULT_TIME_SEC),
      }
    }
    case 'RESET':
      return {
        mode: 'solo',
        selectedTags: [],
        players: [],
        currentPlayerIndex: 0,
        questionQueue: [],
        currentQuestionIndex: 0,
        timer: createTimer(DEFAULT_TIME_SEC),
        currentMultiplier: null,
        round: {},
        uiFlags: { fiftyFiftyHiddenIndices: [], pauseBonusSeconds: 0 },
        phase: 'setup',
        questionStartTime: 0,
        totalQuestions: 5,
        questionsAnswered: 0,
        timePerQuestionSec: DEFAULT_TIME_SEC,
      }
    default:
      return state
  }
}

const initialState: GameState = {
  mode: 'solo',
  selectedTags: [],
  players: [],
  currentPlayerIndex: 0,
  questionQueue: [],
  currentQuestionIndex: 0,
  timer: createTimer(DEFAULT_TIME_SEC),
  currentMultiplier: null,
  round: {},
  uiFlags: { fiftyFiftyHiddenIndices: [], pauseBonusSeconds: 0 },
  phase: 'setup',
  questionStartTime: 0,
  totalQuestions: 5,
  questionsAnswered: 0,
  timePerQuestionSec: DEFAULT_TIME_SEC,
}

const QuizContext = createContext<{
  state: GameState
  dispatch: React.Dispatch<QuizAction>
} | null>(null)

export function QuizGameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(quizReducer, initialState)
  return <QuizContext.Provider value={{ state, dispatch }}>{children}</QuizContext.Provider>
}

export function useQuizGame() {
  const ctx = useContext(QuizContext)
  if (!ctx) throw new Error('useQuizGame must be used within QuizGameProvider')
  return ctx
}
