import { describe, it, expect } from 'vitest'
import { mafiaReducer, initialState } from './MafiaGameContext'
import type { GameState, Player } from './types'

function makePlayers(n: number): Player[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p-${i}`,
    name: `Player ${i + 1}`,
    role: 'civilian' as const,
    alive: true,
  }))
}

describe('mafiaReducer', () => {
  describe('APPLY_NIGHT idempotency', () => {
    it('ignores APPLY_NIGHT when phase is not night step', () => {
      const state: GameState = { ...initialState, phase: 'day', players: makePlayers(5) }
      const next = mafiaReducer(state, { type: 'APPLY_NIGHT' })
      expect(next).toBe(state)
      expect(next.phase).toBe('day')
    })

    it('ignores APPLY_NIGHT when phase is night_intro', () => {
      const state: GameState = { ...initialState, phase: 'night_intro', players: makePlayers(5) }
      const next = mafiaReducer(state, { type: 'APPLY_NIGHT' })
      expect(next).toBe(state)
    })
  })

  describe('CONFIRM_VOTING idempotency', () => {
    it('ignores CONFIRM_VOTING when phase is not voting_summary', () => {
      const state: GameState = { ...initialState, phase: 'voting_collect', players: makePlayers(5) }
      const next = mafiaReducer(state, { type: 'CONFIRM_VOTING' })
      expect(next).toBe(state)
    })
  })

  describe('NEXT_VOTE_COLLECT', () => {
    it('ignores NEXT_VOTE_COLLECT when phase is not voting_collect', () => {
      const state: GameState = { ...initialState, phase: 'day', voteCollectIndex: 0, players: makePlayers(5) }
      const next = mafiaReducer(state, { type: 'NEXT_VOTE_COLLECT' })
      expect(next).toBe(state)
    })
  })
})
