import type { TDPlayer, CardLevel } from './types'

export function clampLevel(l: number): CardLevel {
  if (l <= 1) return 1
  if (l >= 4) return 4
  return l as CardLevel
}

export function shouldLevelUpAfterStreak(streak: number): boolean {
  if (streak < 2) return false
  return Math.random() < 0.35
}

export function applyCompletion(
  player: TDPlayer,
  cardType: 'truth' | 'dare',
  cardLevel: number
): TDPlayer {
  const courage = player.courage + 1
  let respect = player.respect
  let currentLevel = player.currentLevel

  if (cardType === 'truth') respect += 1
  if (cardType === 'dare' && cardLevel >= 3) respect += 1

  if (player.streakCompleted >= 2 && shouldLevelUpAfterStreak(player.streakCompleted + 1)) {
    currentLevel = clampLevel(currentLevel + 1)
  }

  const newStreak = player.streakCompleted + 1
  let tokens = { ...player.tokens }
  if (newStreak > 0 && newStreak % 3 === 0) {
    tokens = { ...tokens, rerollSameLevel: tokens.rerollSameLevel + 1 }
  }

  return {
    ...player,
    courage,
    respect,
    truthCounted: cardType === 'truth' ? player.truthCounted + 1 : player.truthCounted,
    dareCounted: cardType === 'dare' ? player.dareCounted + 1 : player.dareCounted,
    streakCompleted: newStreak,
    currentLevel,
    tokens,
  }
}

export function applyRefusal(player: TDPlayer): TDPlayer {
  return {
    ...player,
    shame: player.shame + 1,
    streakCompleted: 0,
    currentLevel: clampLevel(player.currentLevel + 1),
  }
}

export function applyNotCounted(player: TDPlayer): TDPlayer {
  return {
    ...player,
    notCounted: player.notCounted + 1,
    streakCompleted: 0,
  }
}

export function applyShameCardHeroism(player: TDPlayer): TDPlayer {
  return { ...player, respect: player.respect + 1 }
}
