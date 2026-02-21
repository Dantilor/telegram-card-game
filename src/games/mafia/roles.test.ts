import { describe, it, expect } from 'vitest'
import { getRoleCountsForPlayers, getRolesForPlayers } from './roles'

describe('getRoleCountsForPlayers', () => {
  it('returns zeros for count < 4', () => {
    expect(getRoleCountsForPlayers(0)).toEqual({ mafia: 0, doctor: 0, sheriff: 0, civilian: 0 })
    expect(getRoleCountsForPlayers(3)).toEqual({ mafia: 0, doctor: 0, sheriff: 0, civilian: 0 })
  })

  it('returns zeros for count > 14', () => {
    expect(getRoleCountsForPlayers(15)).toEqual({ mafia: 0, doctor: 0, sheriff: 0, civilian: 0 })
  })

  it('4–5 players: 1 mafia, 1 шериф, 1 доктор', () => {
    expect(getRoleCountsForPlayers(4)).toEqual({ mafia: 1, doctor: 1, sheriff: 1, civilian: 1 })
    expect(getRoleCountsForPlayers(5)).toEqual({ mafia: 1, doctor: 1, sheriff: 1, civilian: 2 })
  })

  it('6–8 players: 2 мафии', () => {
    expect(getRoleCountsForPlayers(6)).toEqual({ mafia: 2, doctor: 1, sheriff: 1, civilian: 2 })
    expect(getRoleCountsForPlayers(7)).toEqual({ mafia: 2, doctor: 1, sheriff: 1, civilian: 3 })
    expect(getRoleCountsForPlayers(8)).toEqual({ mafia: 2, doctor: 1, sheriff: 1, civilian: 4 })
  })

  it('9–11 players: 3 мафии', () => {
    expect(getRoleCountsForPlayers(9)).toEqual({ mafia: 3, doctor: 1, sheriff: 1, civilian: 4 })
    expect(getRoleCountsForPlayers(10)).toEqual({ mafia: 3, doctor: 1, sheriff: 1, civilian: 5 })
    expect(getRoleCountsForPlayers(11)).toEqual({ mafia: 3, doctor: 1, sheriff: 1, civilian: 6 })
  })

  it('12–14 players: 4 мафии', () => {
    expect(getRoleCountsForPlayers(12)).toEqual({ mafia: 4, doctor: 1, sheriff: 1, civilian: 6 })
    expect(getRoleCountsForPlayers(13)).toEqual({ mafia: 4, doctor: 1, sheriff: 1, civilian: 7 })
    expect(getRoleCountsForPlayers(14)).toEqual({ mafia: 4, doctor: 1, sheriff: 1, civilian: 8 })
  })

  it('sum of roles equals count', () => {
    for (let n = 4; n <= 14; n++) {
      const c = getRoleCountsForPlayers(n)
      expect(c.mafia + c.doctor + c.sheriff + c.civilian).toBe(n)
    }
  })
})

describe('getRolesForPlayers', () => {
  it('returns empty array for invalid count', () => {
    expect(getRolesForPlayers(3)).toEqual([])
    expect(getRolesForPlayers(15)).toEqual([])
  })

  it('returns array length equal to count', () => {
    for (let n = 4; n <= 14; n++) {
      const roles = getRolesForPlayers(n)
      expect(roles).toHaveLength(n)
    }
  })

  it('has exactly getRoleCounts mafia, doctor, sheriff, rest civilian', () => {
    for (let n = 4; n <= 14; n++) {
      const roles = getRolesForPlayers(n)
      const counts = getRoleCountsForPlayers(n)
      expect(roles.filter((r) => r === 'mafia')).toHaveLength(counts.mafia)
      expect(roles.filter((r) => r === 'doctor')).toHaveLength(counts.doctor)
      expect(roles.filter((r) => r === 'sheriff')).toHaveLength(counts.sheriff)
      expect(roles.filter((r) => r === 'civilian')).toHaveLength(counts.civilian)
    }
  })
})
