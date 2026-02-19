import type { AliasCategoryId } from './data/words'

export type AliasMode = 'solo' | 'team'

export type AliasTeamSlot = {
  name: string
  players: string[]
  activePlayerIndex: number
}

export type AliasPhase = 'setup' | 'turn_ready' | 'in_round' | 'round_results'

export type AliasState = {
  categoryIds: AliasCategoryId[]
  timerSeconds: 30 | 45 | 60
  mode: AliasMode
  /** Solo / legacy: A vs B */
  scores: { teamA: number; teamB: number }
  bag: string[]
  bagIdx: number
  lastPlayedTeam: 'A' | 'B' | null
  /** Team mode: 6 slots; teamCount = how many to show (2..6) */
  teams: AliasTeamSlot[]
  teamCount: number
  phase: AliasPhase
  currentTeamIndex: number
  /** Indices of active team slots, set at START_GAME */
  activeTeamSlots: number[]
  teamScores: number[]
  roundEndsAt: number | null
  guessed: number
  skipped: number
  /** Guard: END_ROUND dispatched only once */
  roundEndFired: boolean
}

export function getActiveTeams(state: AliasState): AliasTeamSlot[] {
  if (state.activeTeamSlots.length === 0) return []
  return state.activeTeamSlots.map((i) => state.teams[i]!).filter(Boolean)
}

export function getCurrentTeam(state: AliasState): AliasTeamSlot | null {
  const active = getActiveTeams(state)
  const idx = state.currentTeamIndex % Math.max(1, active.length)
  return active[idx] ?? null
}

export function getCurrentTeamSlotIndex(state: AliasState): number {
  if (state.activeTeamSlots.length === 0) return 0
  return state.activeTeamSlots[state.currentTeamIndex % state.activeTeamSlots.length] ?? 0
}
