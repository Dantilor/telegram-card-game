import type { Role } from './types'

export type RoleCounts = { mafia: number; doctor: number; sheriff: number; civilian: number }

/**
 * Баланс: Шериф = 1, Доктор = 1, мафия ≈ 25–30%, остальные мирные.
 */
export function getRoleCountsForPlayers(count: number): RoleCounts {
  if (count < 4 || count > 14) return { mafia: 0, doctor: 0, sheriff: 0, civilian: 0 }
  const sheriff = 1
  const doctor = 1
  let mafiaCount: number
  if (count <= 5) mafiaCount = 1
  else if (count <= 8) mafiaCount = 2
  else if (count <= 11) mafiaCount = 3
  else mafiaCount = 4
  const civilian = Math.max(0, count - mafiaCount - sheriff - doctor)
  return { mafia: mafiaCount, doctor, sheriff, civilian }
}

/**
 * Раздаёт роли по правилам getRoleCountsForPlayers. Гарантирует ровно N мафий и не более 1 доктора/шерифа.
 */
export function getRolesForPlayers(count: number): Role[] {
  const counts = getRoleCountsForPlayers(count)
  if (counts.mafia === 0 && counts.doctor === 0 && counts.sheriff === 0) return []

  const roles: Role[] = []
  for (let i = 0; i < counts.mafia; i++) roles.push('mafia')
  if (counts.doctor) roles.push('doctor')
  if (counts.sheriff) roles.push('sheriff')
  while (roles.length < count) roles.push('civilian')

  return shuffle(roles)
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
