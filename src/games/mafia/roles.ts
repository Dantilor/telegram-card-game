import type { Role } from './types'

export type RoleCounts = { mafia: number; doctor: number; sheriff: number; civilian: number }

/**
 * Состав ролей по количеству игроков (Комиссар = шериф в коде).
 * 4: только мафия + мирные. 5–6: + комиссар. 7: 2 мафии. 8+: + доктор.
 * Маньяк и Дон не реализованы — при 11–14 считаем без них.
 */
export function getRoleCountsForPlayers(count: number): RoleCounts {
  if (count < 4 || count > 14) return { mafia: 0, doctor: 0, sheriff: 0, civilian: 0 }
  let mafiaCount: number
  let sheriff: number
  let doctor: number
  if (count === 4) {
    mafiaCount = 1
    sheriff = 0
    doctor = 0
  } else if (count === 5 || count === 6) {
    mafiaCount = 1
    sheriff = 1
    doctor = 0
  } else if (count === 7) {
    mafiaCount = 2
    sheriff = 1
    doctor = 0
  } else if (count >= 8 && count <= 10) {
    mafiaCount = count >= 10 ? 3 : 2
    sheriff = 1
    doctor = 1
  } else {
    mafiaCount = count >= 14 ? 4 : 3
    sheriff = 1
    doctor = 1
  }
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
