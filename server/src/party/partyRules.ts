/** Pure party-game rules. Routes and tests share these checks. */

export const SLED_MIN_PLAYERS = 3
export const SLED_MAX_PLAYERS = 8

const NIGHT_ROLES = new Set(['don', 'mafia', 'detective', 'doctor', 'maniac'])

export type MafiaTeam = 'mafia' | 'city' | 'neutral'

export function sledStartRefusal(count: number): string | null {
  const current = Number.isInteger(count) ? count : 0
  if (current < SLED_MIN_PLAYERS) {
    const missing = SLED_MIN_PLAYERS - Math.max(0, current)
    return `Нужно ещё ${missing}. Сейчас в комнате ${Math.max(0, current)} из 3–8.`
  }
  if (current > SLED_MAX_PLAYERS) return 'В комнате уже 8 игроков.'
  return null
}

export function missingNightActors<T extends { id: string; name: string; alive: boolean; role: string | null }>(
  players: readonly T[],
  actedIds: ReadonlySet<string>,
): T[] {
  return players.filter(
    (player) => player.alive && player.role != null && NIGHT_ROLES.has(player.role) && !actedIds.has(player.id),
  )
}

/**
 * Одиночка побеждает только как единственный живой игрок.
 * Пока он жив вместе с кем-то, большинство мафии партию не закрывает:
 * иначе дуэль с мафией заканчивалась бы до его ночного хода.
 * mutual — живых не осталось, последнего нет.
 */
export function mafiaWinner(
  players: readonly { alive: boolean; team: MafiaTeam | null }[],
): MafiaTeam | 'mutual' | null {
  const alive = players.filter((player) => player.alive)
  const mafia = alive.filter((player) => player.team === 'mafia').length
  const neutral = alive.filter((player) => player.team === 'neutral').length
  const city = alive.filter((player) => player.team === 'city').length
  if (alive.length === 0) return 'mutual'
  if (alive.length === 1 && neutral === 1) return 'neutral'
  if (neutral > 0) return null
  if (mafia === 0 && city > 0) return 'city'
  if (mafia > 0 && mafia >= alive.length - mafia) return 'mafia'
  return null
}

/** After a tied vote, a 1v1 with the loner must end. Night actions already happened. */
export function maniacTieWinner(
  players: readonly { alive: boolean; team: MafiaTeam | null; role: string | null }[],
  eliminated: boolean,
): MafiaTeam | null {
  const alive = players.filter((player) => player.alive)
  if (eliminated || alive.length !== 2 || !alive.some((player) => player.role === 'maniac')) return null
  const other = alive.find((player) => player.role !== 'maniac')
  return other?.team === 'mafia' ? 'mafia' : 'city'
}

export function splitSupportCast<T>(shuffled: readonly T[], witnessCount: number): { witnesses: T[]; hidden: T } {
  if (!Number.isInteger(witnessCount) || witnessCount < 0 || witnessCount >= shuffled.length) {
    throw new Error('Не хватает отдельных личностей для свидетелей и стёртой роли.')
  }
  const hidden = shuffled[witnessCount]
  if (hidden === undefined) throw new Error('Не хватает отдельных личностей для свидетелей и стёртой роли.')
  return { witnesses: shuffled.slice(0, witnessCount), hidden }
}

export function erasedGuessOptions(input: {
  witnessTitles: readonly string[]
  hiddenTitle: string
  unusedTitles: readonly string[]
}): string[] {
  const decoys = input.unusedTitles.filter((title) => title && title !== input.hiddenTitle).slice(0, 2)
  return [...new Set([...input.witnessTitles, input.hiddenTitle, ...decoys].filter(Boolean))].sort((left, right) =>
    left.localeCompare(right, 'ru'),
  )
}
