import {
  createContext,
  useContext,
  useReducer,
  type ReactNode,
} from 'react'
import type { SabotageState } from './types'
import { pickRandomTask } from './data/tasks'

type SabotageAction =
  | { type: 'START_GAME'; players: Array<{ id: string; name: string }>; taskDurationSeconds: number }
  | { type: 'START_NEXT_ROUND' }
  | { type: 'NEXT_ROLE_VIEW' }
  | { type: 'SET_VOTE'; voterId: string; targetId: string }
  | { type: 'NEXT_VOTE_COLLECT' }
  | { type: 'BACK_FROM_TASK' }
  | { type: 'RESET' }

function sabotageReducer(state: SabotageState, action: SabotageAction): SabotageState {
  switch (action.type) {
    case 'START_GAME': {
      const players = [...action.players]
      const saboteurIdx = Math.floor(Math.random() * players.length)
      const saboteurId = players[saboteurIdx]!.id
      const updated = players.map((p, i) => ({
        ...p,
        role: i === saboteurIdx ? ('saboteur' as const) : ('player' as const),
      }))
      return {
        players: updated,
        phase: 'role',
        roleViewIndex: 0,
        task: pickRandomTask(),
        taskDurationSeconds: action.taskDurationSeconds,
        votes: {},
        voteCollectIndex: 0,
        saboteurId,
        winner: null,
      }
    }
    case 'START_NEXT_ROUND': {
      if (state.phase !== 'result' || state.players.length === 0) return state
      const players = [...state.players]
      const saboteurIdx = Math.floor(Math.random() * players.length)
      const saboteurId = players[saboteurIdx]!.id
      const updated = players.map((p, i) => ({
        ...p,
        role: i === saboteurIdx ? ('saboteur' as const) : ('player' as const),
      }))
      return {
        players: updated,
        phase: 'role',
        roleViewIndex: 0,
        task: pickRandomTask(),
        taskDurationSeconds: state.taskDurationSeconds,
        votes: {},
        voteCollectIndex: 0,
        saboteurId,
        winner: null,
      }
    }
    case 'NEXT_ROLE_VIEW':
      if (state.roleViewIndex >= state.players.length - 1) {
        return { ...state, phase: 'task', roleViewIndex: 0 }
      }
      return { ...state, roleViewIndex: state.roleViewIndex + 1 }
    case 'SET_VOTE':
      return {
        ...state,
        votes: { ...state.votes, [action.voterId]: action.targetId },
      }
    case 'NEXT_VOTE_COLLECT': {
      if (state.voteCollectIndex >= state.players.length - 1) {
        const voteCounts: Record<string, number> = {}
        state.players.forEach((p) => { voteCounts[p.id] = 0 })
        Object.values(state.votes).forEach((id) => {
          voteCounts[id] = (voteCounts[id] ?? 0) + 1
        })
        const max = Math.max(0, ...Object.values(voteCounts))
        const tied = Object.entries(voteCounts).filter(([, c]) => c === max)
        const votedOut = tied.length === 1 && max > 0 ? tied[0]![0] : null
        const correct = votedOut === state.saboteurId
        return {
          ...state,
          phase: 'result',
          voteCollectIndex: 0,
          winner: correct ? 'team' : 'saboteur',
        }
      }
      return { ...state, voteCollectIndex: state.voteCollectIndex + 1 }
    }
    case 'BACK_FROM_TASK':
      if (state.phase !== 'task') return state
      return {
        ...state,
        phase: 'role',
        roleViewIndex: Math.max(0, state.players.length - 1),
      }
    case 'RESET':
      return {
        players: [],
        phase: 'setup',
        roleViewIndex: 0,
        task: '',
        taskDurationSeconds: 180,
        votes: {},
        voteCollectIndex: 0,
        saboteurId: null,
        winner: null,
      }
    default:
      return state
  }
}

const initialState: SabotageState = {
  players: [],
  phase: 'setup',
  roleViewIndex: 0,
  task: '',
  taskDurationSeconds: 180,
  votes: {},
  voteCollectIndex: 0,
  saboteurId: null,
  winner: null,
}

const SabotageContext = createContext<{
  state: SabotageState
  dispatch: React.Dispatch<SabotageAction>
} | null>(null)

export function SabotageGameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(sabotageReducer, initialState)
  return (
    <SabotageContext.Provider value={{ state, dispatch }}>
      {children}
    </SabotageContext.Provider>
  )
}

export function useSabotageGame() {
  const ctx = useContext(SabotageContext)
  if (!ctx) throw new Error('useSabotageGame must be used within SabotageGameProvider')
  return ctx
}
