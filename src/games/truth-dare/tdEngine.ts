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
  cardLevel: number,
  voteHarder: boolean
): TDPlayer {
  let courage = player.courage + 1
  let respect = player.respect
  let currentLevel = player.currentLevel

  if (cardType === 'truth') respect += 1
  if (cardType === 'dare' && cardLevel >= 3) respect += 1

  if (voteHarder) {
    courage += 1
    if (Math.random() < 0.5) {
      currentLevel = clampLevel(currentLevel + 1)
    } else {
      currentLevel = clampLevel(currentLevel + 1)
    }
  } else if (player.streakCompleted >= 2 && shouldLevelUpAfterStreak(player.streakCompleted + 1)) {
    currentLevel = clampLevel(currentLevel + 1)
  }

  const newStreak = player.streakCompleted + 1
  let tokens = { ...player.tokens }
  if (newStreak > 0 && newStreak % 3 === 0) {
    tokens = Math.random() < 0.5
      ? { ...tokens, skipNoShame: tokens.skipNoShame + 1 }
      : { ...tokens, rerollSameLevel: tokens.rerollSameLevel + 1 }
  }

  return {
    ...player,
    courage,
    respect,
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

export function applySkipNoShame(player: TDPlayer): TDPlayer {
  return {
    ...player,
    tokens: {
      ...player.tokens,
      skipNoShame: Math.max(0, player.tokens.skipNoShame - 1),
    },
  }
}

export function applyShameCardHeroism(player: TDPlayer): TDPlayer {
  return { ...player, respect: player.respect + 1 }
}
