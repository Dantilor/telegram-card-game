import type { Role } from './types'

export type RoleCounts = { mafia: number; doctor: number; sheriff: number; civilian: number }

export function getRoleCountsForPlayers(count: number): RoleCounts {
  if (count < 4 || count > 10) return { mafia: 0, doctor: 0, sheriff: 0, civilian: 0 }
  let mafiaCount = 1
  if (count >= 7) mafiaCount = 2
  if (count >= 10) mafiaCount = 3
  return {
    mafia: mafiaCount,
    doctor: 1,
    sheriff: 1,
    civilian: Math.max(0, count - mafiaCount - 2),
  }
}

export function getRolesForPlayers(count: number): Role[] {
  const roles: Role[] = []
  if (count < 4 || count > 10) return roles

  let mafiaCount = 1
  if (count >= 7) mafiaCount = 2
  if (count >= 10) mafiaCount = 3

  for (let i = 0; i < mafiaCount; i++) roles.push('mafia')
  roles.push('doctor')
  roles.push('sheriff')
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
