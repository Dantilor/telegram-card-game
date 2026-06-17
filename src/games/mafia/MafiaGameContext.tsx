import {
  createContext,
  useContext,
  useReducer,
  type ReactNode,
} from 'react'
import type { GameState, Player, NightAction } from './types'
import { getRolesForPlayers } from './roles'

type MafiaAction =
  | { type: 'START_GAME'; players: Player[]; hostName: string }
  | { type: 'NEXT_ROLE_VIEW' }
  | { type: 'SET_NIGHT_MAFIA'; target: string | null }
  | { type: 'SET_NIGHT_DOCTOR'; target: string | null }
  | { type: 'SET_NIGHT_SHERIFF'; target: string | null; result: boolean }
  | { type: 'APPLY_NIGHT' }
  | { type: 'SET_PHASE'; phase: GameState['phase'] }
  | { type: 'SET_VOTE'; voterId: string; targetId: string }
  | { type: 'NEXT_VOTE_COLLECT' }
  | { type: 'SUBMIT_VOTE'; voterId: string; targetId: string }
  | { type: 'CONFIRM_VOTING' }
  | { type: 'START_NEXT_NIGHT' }
  | { type: 'APPLY_VOTING' }
  | { type: 'RESET' }

const initialNightAction: NightAction = {
  mafiaTarget: null,
  doctorTarget: null,
  sheriffTarget: null,
  sheriffResult: null,
}

export function mafiaReducer(state: GameState, action: MafiaAction): GameState {
  switch (action.type) {
    case 'START_GAME': {
      const roles = getRolesForPlayers(action.players.length)
      const civilianCount = roles.filter((r) => r === 'civilian').length
      const civilianIndices: (0 | 1)[] = []
      for (let i = 0; i < civilianCount; i++) civilianIndices.push((i % 2) as 0 | 1)
      for (let i = civilianIndices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [civilianIndices[i], civilianIndices[j]] = [civilianIndices[j], civilianIndices[i]]
      }
      let civilianIdx = 0
      const players = action.players.map((p, i) => {
        const role = roles[i] ?? 'civilian'
        const player: Player = { ...p, role, alive: true }
        if (role === 'civilian') player.civilianImageIndex = civilianIndices[civilianIdx++]
        return player
      })
      return {
        players,
        hostName: action.hostName.trim() || 'Ведущий',
        roundNumber: 1,
        phase: 'roles',
        roleViewIndex: 0,
        nightAction: initialNightAction,
        nightResult: null,
        discussionSeconds: 90,
        votes: {},
        voteCollectIndex: 0,
        votingSummaryTargetId: null,
        winner: null,
      }
    }
    case 'NEXT_ROLE_VIEW':
      if (state.roleViewIndex >= state.players.length - 1) {
        return { ...state, phase: 'night_intro', roleViewIndex: 0 }
      }
      return { ...state, roleViewIndex: state.roleViewIndex + 1 }
    case 'SET_NIGHT_MAFIA':
      return {
        ...state,
        nightAction: { ...state.nightAction, mafiaTarget: action.target },
      }
    case 'SET_NIGHT_DOCTOR':
      return {
        ...state,
        nightAction: { ...state.nightAction, doctorTarget: action.target },
      }
    case 'SET_NIGHT_SHERIFF':
      return {
        ...state,
        nightAction: {
          ...state.nightAction,
          sheriffTarget: action.target,
          sheriffResult: action.result,
        },
      }
    case 'APPLY_NIGHT': {
      // Идемпотентность: применяем ночь только из фазы последнего шага ночи (один раз за раунд)
      const allowedPhases = ['night_mafia', 'night_doctor', 'night_sheriff'] as const
      if (!allowedPhases.includes(state.phase as typeof allowedPhases[number])) {
        return state
      }
      const { mafiaTarget, doctorTarget } = state.nightAction
      const alivePlayers = state.players.filter((p) => p.alive)
      let victim: string | null = mafiaTarget
      if (victim && victim === doctorTarget) victim = null
      const victimPlayer = alivePlayers.find((p) => p.id === victim)
      let nightResult = 'Ночью никого не убили.'
      if (victimPlayer) {
        nightResult = `Мафия убила ${victimPlayer.name}.`
      }
      const players = state.players.map((p) =>
        p.id === victim ? { ...p, alive: false } : p
      )
      const mafiaLeft = players.filter((p) => p.alive && p.role === 'mafia').length
      const peacefulLeft = players.filter((p) => p.alive && p.role !== 'mafia').length
      const nightWinner: 'peaceful' | 'mafia' | null =
        mafiaLeft === 0 ? 'peaceful' : mafiaLeft >= peacefulLeft ? 'mafia' : null
      return {
        ...state,
        players,
        phase: nightWinner ? 'result' : 'day',
        nightResult,
        nightAction: initialNightAction,
        winner: nightWinner ?? state.winner,
      }
    }
    case 'SET_PHASE':
      return { ...state, phase: action.phase }
    case 'SET_VOTE':
      return {
        ...state,
        votes: { ...state.votes, [action.voterId]: action.targetId },
      }
    case 'SUBMIT_VOTE': {
      // Один dispatch: добавить голос и сразу перейти к следующему или к итогам — экран итогов не зависает
      if (state.phase !== 'voting_collect') return state
      const votes = { ...state.votes, [action.voterId]: action.targetId }
      const alive = state.players.filter((p) => p.alive)
      const nextIndex = state.voteCollectIndex + 1
      if (nextIndex < alive.length) {
        return { ...state, votes, voteCollectIndex: nextIndex }
      }
      const voteCounts: Record<string, number> = {}
      alive.forEach((p) => { voteCounts[p.id] = 0 })
      Object.values(votes).forEach((id) => {
        if (alive.some((p) => p.id === id)) voteCounts[id] = (voteCounts[id] ?? 0) + 1
      })
      const max = Math.max(0, ...Object.values(voteCounts))
      const tied = Object.entries(voteCounts).filter(([, c]) => c === max)
      let eliminated: string | null = null
      if (tied.length === 1 && max > 0) eliminated = tied[0][0]
      return {
        ...state,
        votes,
        voteCollectIndex: 0,
        phase: 'voting_summary',
        votingSummaryTargetId: eliminated,
      }
    }
    case 'NEXT_VOTE_COLLECT': {
      if (state.phase !== 'voting_collect') return state
      const alive = state.players.filter((p) => p.alive)
      if (state.voteCollectIndex >= alive.length - 1) {
        const voteCounts: Record<string, number> = {}
        alive.forEach((p) => { voteCounts[p.id] = 0 })
        Object.values(state.votes).forEach((id) => {
          if (alive.some((p) => p.id === id)) voteCounts[id] = (voteCounts[id] ?? 0) + 1
        })
        const max = Math.max(0, ...Object.values(voteCounts))
        const tied = Object.entries(voteCounts).filter(([, c]) => c === max)
        let eliminated: string | null = null
        if (tied.length === 1 && max > 0) eliminated = tied[0][0]
        return {
          ...state,
          voteCollectIndex: 0,
          phase: 'voting_summary',
          votingSummaryTargetId: eliminated,
        }
      }
      return { ...state, voteCollectIndex: state.voteCollectIndex + 1 }
    }
    case 'CONFIRM_VOTING': {
      // Идемпотентность: казнь только из фазы итогов голосования (один раз за раунд)
      if (state.phase !== 'voting_summary') {
        return state
      }
      const eliminated = state.votingSummaryTargetId
      if (import.meta.env.DEV) {
        console.log('[Mafia] CONFIRM_VOTING', {
          phase: state.phase,
          eliminatedId: eliminated ?? 'tie',
          nextPhase: 'result | round_summary',
        })
      }
      const players = state.players.map((p) =>
        p.id === eliminated ? { ...p, alive: false } : p
      )
      const mafiaLeft = players.filter((p) => p.alive && p.role === 'mafia').length
      const peacefulLeft = players.filter((p) => p.alive && p.role !== 'mafia').length
      let winner: 'peaceful' | 'mafia' | null = null
      if (mafiaLeft === 0) winner = 'peaceful'
      else if (mafiaLeft >= peacefulLeft) winner = 'mafia'
      return {
        ...state,
        players,
        votes: {},
        votingSummaryTargetId: winner ? null : eliminated,
        phase: winner ? 'result' : 'round_summary',
        winner: winner ?? state.winner,
      }
    }
    case 'START_NEXT_NIGHT': {
      if (state.phase !== 'round_summary') return state
      return {
        ...state,
        phase: 'night_intro',
        votingSummaryTargetId: null,
        roundNumber: state.roundNumber + 1,
      }
    }
    case 'APPLY_VOTING':
      return state
    case 'RESET':
      return {
        players: [],
        hostName: '',
        roundNumber: 0,
        phase: 'setup',
        roleViewIndex: 0,
        nightAction: initialNightAction,
        nightResult: null,
        discussionSeconds: 90,
        votes: {},
        voteCollectIndex: 0,
        votingSummaryTargetId: null,
        winner: null,
      }
    default:
      return state
  }
}

export const initialState: GameState = {
  players: [],
  hostName: '',
  roundNumber: 0,
  phase: 'setup',
  roleViewIndex: 0,
  nightAction: initialNightAction,
  nightResult: null,
  discussionSeconds: 90,
  votes: {},
  voteCollectIndex: 0,
  votingSummaryTargetId: null,
  winner: null,
}

const MafiaContext = createContext<{
  state: GameState
  dispatch: React.Dispatch<MafiaAction>
} | null>(null)

export function MafiaGameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(mafiaReducer, initialState)
  return (
    <MafiaContext.Provider value={{ state, dispatch }}>
      {children}
    </MafiaContext.Provider>
  )
}

export function useMafiaGame() {
  const ctx = useContext(MafiaContext)
  if (!ctx) throw new Error('useMafiaGame must be used within MafiaGameProvider')
  return ctx
}
