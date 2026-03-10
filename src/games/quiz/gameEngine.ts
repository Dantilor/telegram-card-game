import type { Question, Multiplier } from './types'

const BASE_POINTS: Record<number, number> = {
  1: 10,
  2: 20,
  3: 30,
}

const PENALTY_MULT: Record<Multiplier, number> = {
  1: 0.5,
  2: 1,
  3: 1.5,
}

export function getBasePoints(difficulty: number): number {
  return BASE_POINTS[difficulty] ?? 10
}

export function getPenaltyMultiplier(mult: Multiplier): number {
  return PENALTY_MULT[mult] ?? 1
}

/** Простое начисление: +1 за правильный ответ, −1 за неправильный (суммируется). */
export function calculatePoints(
  _question: Question,
  _multiplier: Multiplier,
  isCorrect: boolean,
  options: {
    streakBonus?: boolean
    speedBonus?: boolean
    insurance?: boolean
  }
): { earned: number; lost: number } {
  if (isCorrect) return { earned: 1, lost: 0 }
  if (options.insurance) return { earned: 0, lost: 0 }
  return { earned: 0, lost: 1 }
}

export function getFiftyFiftyIndices(correctIndex: number): number[] {
  const wrong = [0, 1, 2, 3].filter((i) => i !== correctIndex)
  const shuffled = [...wrong].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, 2)
}

export function getRandomBooster(): 'fiftyFifty' | 'pause' | 'insurance' {
  const arr: Array<'fiftyFifty' | 'pause' | 'insurance'> = ['fiftyFifty', 'pause', 'insurance']
  return arr[Math.floor(Math.random() * arr.length)]!
}
