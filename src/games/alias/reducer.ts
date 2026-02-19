import type { AliasState } from './types'
import type { AliasCategoryId } from './data/words'
import { resetAllAssociations } from './state'
import { getWordsByCategoryIds, shuffleFisherYates } from './data/words'

export type AliasAction =
  | { type: 'SET_TEAM_COUNT'; count: number }
  | { type: 'SET_CATEGORY_IDS'; categoryIds: AliasCategoryId[] }
  | { type: 'SET_TEAM_NAME'; slotIndex: number; name: string }
  | { type: 'ADD_PLAYER'; slotIndex: number; playerName: string }
  | { type: 'REMOVE_PLAYER'; slotIndex: number; playerIndex: number }
  | { type: 'SET_TIMER'; seconds: 30 | 45 | 60 }
  | { type: 'START_GAME' }
  | { type: 'RESET_TO_SETUP' }
  | { type: 'RESET_ALL' }
  | { type: 'NEXT_HOST' }
  | { type: 'START_ROUND' }
  | { type: 'GUESSED' }
  | { type: 'SKIPPED' }
  | { type: 'END_ROUND' }
  | { type: 'PASS_TURN' }

export function aliasReducer(state: AliasState, action: AliasAction): AliasState {
  switch (action.type) {
    case 'SET_TEAM_COUNT': {
      const count = action.count >= 2 && action.count <= 6 ? action.count : state.teamCount
      return { ...state, teamCount: count }
    }

    case 'SET_TEAM_NAME': {
      if (action.slotIndex < 0 || action.slotIndex >= 6) return state
      const teams = state.teams.map((t, i) =>
        i === action.slotIndex ? { ...t, name: action.name } : t
      )
      return { ...state, teams }
    }

    case 'ADD_PLAYER': {
      if (action.slotIndex < 0 || action.slotIndex >= 6) return state
      const name = action.playerName.trim()
      if (name === '') return state
      const teams = state.teams.map((t, i) => {
        if (i !== action.slotIndex) return t
        if (t.players.includes(name)) return t
        return { ...t, players: [...t.players, name] }
      })
      return { ...state, teams }
    }

    case 'REMOVE_PLAYER': {
      if (action.slotIndex < 0 || action.slotIndex >= 6) return state
      const teams = state.teams.map((t, i) => {
        if (i !== action.slotIndex) return t
        const players = t.players.filter((_, j) => j !== action.playerIndex)
        const activePlayerIndex = Math.min(t.activePlayerIndex, Math.max(0, players.length - 1))
        return { ...t, players, activePlayerIndex }
      })
      return { ...state, teams }
    }

    case 'SET_CATEGORY_IDS': {
      return { ...state, categoryIds: action.categoryIds }
    }

    case 'SET_TIMER': {
      return { ...state, timerSeconds: action.seconds }
    }

    case 'RESET_TO_SETUP': {
      return {
        ...state,
        phase: 'setup',
        currentTeamIndex: 0,
        activeTeamSlots: [],
        teamScores: [0, 0, 0, 0, 0, 0],
        bag: [],
        bagIdx: 0,
        roundEndsAt: null,
        guessed: 0,
        skipped: 0,
        roundEndFired: false,
      }
    }

    case 'RESET_ALL': {
      return resetAllAssociations()
    }

    case 'START_GAME': {
      const n = state.teamCount
      for (let i = 0; i < n; i++) {
        const t = state.teams[i]
        if (!t || t.name.trim() === '' || t.players.length === 0) return state
      }
      const words = getWordsByCategoryIds(state.categoryIds)
      if (words.length === 0) return state
      const activeSlots = Array.from({ length: n }, (_, i) => i)
      const bag = shuffleFisherYates(words)
      const teamScores = [0, 0, 0, 0, 0, 0]
      return {
        ...state,
        phase: 'turn_ready',
        currentTeamIndex: 0,
        activeTeamSlots: activeSlots,
        teamScores,
        bag,
        bagIdx: 0,
        roundEndsAt: null,
        guessed: 0,
        skipped: 0,
        roundEndFired: false,
      }
    }

    case 'NEXT_HOST': {
      if (state.phase !== 'turn_ready') return state
      const slotIdx = state.activeTeamSlots[state.currentTeamIndex]
      if (slotIdx === undefined) return state
      const team = state.teams[slotIdx]
      if (!team || team.players.length === 0) return state
      const nextHost = (team.activePlayerIndex + 1) % team.players.length
      const teams = state.teams.map((t, i) =>
        i === slotIdx ? { ...t, activePlayerIndex: nextHost } : t
      )
      return { ...state, teams }
    }

    case 'START_ROUND': {
      if (state.phase !== 'turn_ready') return state
      const now = Date.now()
      return {
        ...state,
        phase: 'in_round',
        roundEndsAt: now + state.timerSeconds * 1000,
        guessed: 0,
        skipped: 0,
        roundEndFired: false,
      }
    }

    case 'GUESSED': {
      if (state.phase !== 'in_round') return state
      const slotIdx = state.activeTeamSlots[state.currentTeamIndex]
      if (slotIdx === undefined) return state
      const teamScores = [...state.teamScores]
      teamScores[slotIdx] = (teamScores[slotIdx] ?? 0) + 1
      let nextBagIdx = state.bagIdx + 1
      let bag = state.bag
      if (nextBagIdx >= state.bag.length && state.categoryIds.length > 0) {
        const words = getWordsByCategoryIds(state.categoryIds)
        if (words.length > 0) {
          bag = shuffleFisherYates(words)
          nextBagIdx = 0
        }
      }
      return {
        ...state,
        guessed: state.guessed + 1,
        teamScores,
        bag,
        bagIdx: nextBagIdx,
      }
    }

    case 'SKIPPED': {
      if (state.phase !== 'in_round') return state
      let nextBagIdx = state.bagIdx + 1
      let bag = state.bag
      if (nextBagIdx >= state.bag.length && state.categoryIds.length > 0) {
        const words = getWordsByCategoryIds(state.categoryIds)
        if (words.length > 0) {
          bag = shuffleFisherYates(words)
          nextBagIdx = 0
        }
      }
      return {
        ...state,
        skipped: state.skipped + 1,
        bag,
        bagIdx: nextBagIdx,
      }
    }

    case 'END_ROUND': {
      if (state.phase !== 'in_round' || state.roundEndFired) return state
      return {
        ...state,
        phase: 'round_results',
        roundEndFired: true,
      }
    }

    case 'PASS_TURN': {
      if (state.phase !== 'round_results') return state
      const n = state.activeTeamSlots.length
      if (n === 0) return state
      const nextIndex = (state.currentTeamIndex + 1) % n
      return {
        ...state,
        phase: 'turn_ready',
        currentTeamIndex: nextIndex,
      }
    }

    default:
      return state
  }
}
