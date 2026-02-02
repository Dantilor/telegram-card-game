import type { QuizProgress } from './types'
import { LEAGUES } from './types'

const STORAGE_KEY = 'QUIZ_PROGRESS_V1'

const defaultProgress: QuizProgress = {
  dailyStreakCount: 0,
  lastPlayDate: '',
  coins: 0,
  totalScore: 0,
}

export function loadProgress(): QuizProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...defaultProgress }
    const parsed = JSON.parse(raw) as Partial<QuizProgress>
    return {
      dailyStreakCount: parsed.dailyStreakCount ?? 0,
      lastPlayDate: parsed.lastPlayDate ?? '',
      coins: parsed.coins ?? 0,
      totalScore: parsed.totalScore ?? 0,
    }
  } catch {
    return { ...defaultProgress }
  }
}

export function saveProgress(p: QuizProgress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
  } catch {
    // ignore
  }
}

export function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10)
}

export function addCoins(p: QuizProgress, amount: number): QuizProgress {
  return { ...p, coins: p.coins + amount }
}

export function addScore(p: QuizProgress, score: number): QuizProgress {
  return { ...p, totalScore: p.totalScore + score }
}

export function processDailyStreak(p: QuizProgress): { progress: QuizProgress; reward?: { type: 'booster' | 'coins'; value?: number } } {
  const today = getTodayDate()
  if (p.lastPlayDate === today) return { progress: p }

  const last = p.lastPlayDate ? new Date(p.lastPlayDate + 'T12:00:00') : null
  const todayDate = new Date(today + 'T12:00:00')
  const diffDays = last ? Math.round((todayDate.getTime() - last.getTime()) / 86400000) : 999

  const newStreak = diffDays === 1 ? (p.dailyStreakCount || 0) + 1 : 1
  const rewardValue = 20
  const withCoins = { ...p, coins: p.coins + rewardValue, lastPlayDate: today, dailyStreakCount: newStreak }
  return { progress: withCoins, reward: { type: 'coins' as const, value: rewardValue } }
}

export function getLeague(totalScore: number): string {
  if (totalScore >= LEAGUES.pro.min) return LEAGUES.pro.label
  if (totalScore >= LEAGUES.confident.min) return LEAGUES.confident.label
  return LEAGUES.novice.label
}
