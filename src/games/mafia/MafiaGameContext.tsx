import {
  createContext,
  useContext,
  useReducer,
  type ReactNode,
} from 'react'
import type { GameState, Player, NightAction } from './types'
import { getRolesForPlayers } from './roles'

type MafiaAction =
  | { type: 'START_GAME'; players: Player[] }
  | { type: 'NEXT_ROLE_VIEW' }
  | { type: 'SET_NIGHT_MAFIA'; target: string | null }
  | { type: 'SET_NIGHT_DOCTOR'; target: string | null }
  | { type: 'SET_NIGHT_SHERIFF'; target: string | null; result: boolean }
  | { type: 'APPLY_NIGHT' }
  | { type: 'SET_PHASE'; phase: GameState['phase'] }
  | { type: 'SET_VOTE'; voterId: string; targetId: string }
  | { type: 'NEXT_VOTE_COLLECT' }
  | { type: 'CONFIRM_VOTING' }
  | { type: 'APPLY_VOTING' }
  | { type: 'RESET' }

const initialNightAction: NightAction = {
  mafiaTarget: null,
  doctorTarget: null,
  sheriffTarget: null,
  sheriffResult: null,
}

function mafiaReducer(state: GameState, action: MafiaAction): GameState {
  switch (action.type) {
    case 'START_GAME': {
      const roles = getRolesForPlayers(action.players.length)
      const players = action.players.map((p, i) => ({
        ...p,
        role: roles[i] ?? 'civilian',
        alive: true,
      }))
      return {
        players,
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
      return {
        ...state,
        players,
        phase: 'day',
        nightResult,
        nightAction: initialNightAction,
      }
    }
    case 'SET_PHASE':
      return { ...state, phase: action.phase }
    case 'SET_VOTE':
      return {
        ...state,
        votes: { ...state.votes, [action.voterId]: action.targetId },
      }
    case 'NEXT_VOTE_COLLECT': {
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
      const eliminated = state.votingSummaryTargetId
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
        votingSummaryTargetId: null,
        phase: winner ? 'result' : 'night_intro',
        winner: winner ?? state.winner,
      }
    }
    case 'APPLY_VOTING':
      return state
    case 'RESET':
      return {
        players: [],
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

const initialState: GameState = {
  players: [],
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
