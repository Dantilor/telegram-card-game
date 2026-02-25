import {
  createContext,
  useContext,
  useReducer,
  type ReactNode,
} from 'react'
import type { TDState, TDPlayer, Card, CardType, CardLevel } from './types'
import { pickCard, pickShameCard } from './data/cards'
import {
  applyCompletion,
  applyRefusal,
  applyNotCounted,
  applyShameCardHeroism,
  clampLevel,
} from './tdEngine'

type TDAction =
  | { type: 'START'; players: Array<{ name: string }>; totalSteps: number; tags: string[] }
  | { type: 'CHOICE'; choice: CardType }
  | { type: 'COMPLETED' }
  | { type: 'REFUSED' }
  | { type: 'REROLL' }
  | { type: 'VOTE'; playerId: string; vote: 'ok' | 'notCounted' }
  | { type: 'FINISH_VOTE' }
  | { type: 'NEXT_TURN' }
  | { type: 'CONTINUE_10' }
  | { type: 'RESET' }
  | { type: 'SHAME_CHOICE'; choice: CardType }

function createPlayer(id: string, name: string): TDPlayer {
  return {
    id,
    name,
        courage: 0,
    shame: 0,
    respect: 0,
    truthCounted: 0,
    dareCounted: 0,
    notCounted: 0,
    tokens: { rerollSameLevel: 1 },
    streakCompleted: 0,
    currentLevel: 1,
  }
}

function tdReducer(state: TDState, action: TDAction): TDState {
  switch (action.type) {
    case 'START': {
      const players = action.players.map((p, i) =>
        createPlayer(`p-${i}-${Date.now()}`, p.name.trim() || `Игрок ${i + 1}`)
      )
      return {
        players,
        currentPlayerIndex: 0,
        stepCount: 0,
        totalStepsTarget: action.totalSteps,
        phase: 'choice',
        currentChoice: null,
        currentCard: null,
        currentLevel: 1,
        forcedNoRefuse: false,
        shameCardActive: false,
        selectedTags: action.tags,
        usedCardIds: [],
        vote: { enabled: false, votes: {}, result: null },
      }
    }
    case 'CHOICE': {
      const player = state.players[state.currentPlayerIndex]
      if (!player) return state
      const shameActive = player.shame >= 3
      let card: Card | null = null
      let forcedNoRefuse = false

      if (shameActive) {
        forcedNoRefuse = true
        if (action.choice === 'truth') {
          card = pickShameCard('truth', 4, state.selectedTags, state.usedCardIds)
        } else {
          card = pickShameCard('dare', 3, state.selectedTags, state.usedCardIds)
        }
        if (!card) {
          card = pickCard(action.choice, clampLevel(player.currentLevel + 2), state.selectedTags, state.usedCardIds)
        }
      } else {
        card = pickCard(action.choice, player.currentLevel, state.selectedTags, state.usedCardIds)
      }

      if (!card) {
        card = pickCard(action.choice, 1, [], state.usedCardIds) ?? state.currentCard
      }
      if (!card) return state

      return {
        ...state,
        phase: 'card',
        currentChoice: action.choice,
        currentCard: card,
        currentLevel: card.level,
        forcedNoRefuse,
        shameCardActive: shameActive,
      }
    }
    case 'SHAME_CHOICE': {
      const player = state.players[state.currentPlayerIndex]
      if (!player || player.shame < 3) return state
      const level: CardLevel = action.choice === 'truth' ? 4 : 3
      const card = pickShameCard(action.choice, level, state.selectedTags, state.usedCardIds)
      if (!card) return state
      return {
        ...state,
        phase: 'card',
        currentChoice: action.choice,
        currentCard: card,
        currentLevel: card.level,
        forcedNoRefuse: true,
        shameCardActive: true,
      }
    }
    case 'COMPLETED': {
      const player = state.players[state.currentPlayerIndex]
      const card = state.currentCard
      if (!player || !card) return state

      const newPlayers = state.players.map((p) =>
        p.id === player.id ? applyCompletion(p, card.type, card.level) : p
      )
      const others = state.players.filter((p) => p.id !== player.id)

      if (state.shameCardActive) {
        const withHero = newPlayers.map((p) =>
          p.id === player.id ? applyShameCardHeroism(p) : p
        )
        return {
          ...state,
          players: withHero,
          usedCardIds: [...state.usedCardIds, card.id],
          phase: 'choice',
          currentChoice: null,
          currentCard: null,
          stepCount: state.stepCount + 1,
          currentPlayerIndex: (state.currentPlayerIndex + 1) % state.players.length,
          vote: { enabled: false, votes: {}, result: null },
        }
      }

      if (others.length > 0) {
        return {
          ...state,
          players: newPlayers,
          usedCardIds: [...state.usedCardIds, card.id],
          phase: 'vote',
          vote: { enabled: true, votes: {}, result: null },
        }
      }

      return {
        ...state,
        players: newPlayers,
        usedCardIds: [...state.usedCardIds, card.id],
        stepCount: state.stepCount + 1,
        currentPlayerIndex: (state.currentPlayerIndex + 1) % state.players.length,
        phase: 'choice',
        currentChoice: null,
        currentCard: null,
      }
    }
    case 'REFUSED': {
      const player = state.players[state.currentPlayerIndex]
      if (!player || state.forcedNoRefuse) return state

      const newPlayers = state.players.map((p) =>
        p.id === player.id ? applyRefusal(p) : p
      )
      return {
        ...state,
        players: newPlayers,
        stepCount: state.stepCount + 1,
        currentPlayerIndex: (state.currentPlayerIndex + 1) % state.players.length,
        phase: 'choice',
        currentChoice: null,
        currentCard: null,
      }
    }
    case 'REROLL': {
      const player = state.players[state.currentPlayerIndex]
      const card = state.currentCard
      if (!player || !card || player.tokens.rerollSameLevel <= 0) return state

      const newCard = pickCard(card.type, card.level, state.selectedTags, [
        ...state.usedCardIds,
        card.id,
      ])
      if (!newCard) return state

      const newPlayers = state.players.map((p) =>
        p.id === player.id
          ? { ...p, tokens: { ...p.tokens, rerollSameLevel: p.tokens.rerollSameLevel - 1 } }
          : p
      )
      return {
        ...state,
        players: newPlayers,
        currentCard: newCard,
      }
    }
    case 'VOTE': {
      return {
        ...state,
        vote: {
          ...state.vote,
          votes: { ...state.vote.votes, [action.playerId]: action.vote },
        },
      }
    }
    case 'FINISH_VOTE': {
      const votes = Object.values(state.vote.votes)
      const notCountedCount = votes.filter((v) => v === 'notCounted').length
      const voteResult = notCountedCount > votes.length / 2 ? 'notCounted' : 'ok'

      const player = state.players[state.currentPlayerIndex]
      const card = state.currentCard
      if (!player || !card) return state

      const updated =
        voteResult === 'ok'
          ? applyCompletion(player, card.type, card.level)
          : applyNotCounted(player)
      const newPlayers = state.players.map((p) => (p.id === player.id ? updated : p))

      if ((state.stepCount + 1) >= state.totalStepsTarget) {
        return {
          ...state,
          players: newPlayers,
          usedCardIds: [...state.usedCardIds, card.id],
          stepCount: state.stepCount + 1,
          phase: 'result',
          vote: { ...state.vote, result: voteResult },
        }
      }

      return {
        ...state,
        players: newPlayers,
        usedCardIds: [...state.usedCardIds, card.id],
        stepCount: state.stepCount + 1,
        currentPlayerIndex: (state.currentPlayerIndex + 1) % state.players.length,
        phase: 'choice',
        currentChoice: null,
        currentCard: null,
        vote: { enabled: false, votes: {}, result: voteResult },
      }
    }
    case 'NEXT_TURN':
      if ((state.stepCount + 1) >= state.totalStepsTarget) {
        return { ...state, phase: 'result' }
      }
      return {
        ...state,
        currentPlayerIndex: (state.currentPlayerIndex + 1) % state.players.length,
        phase: 'choice',
        currentChoice: null,
        currentCard: null,
      }
    case 'CONTINUE_10':
      return {
        ...state,
        stepCount: 0,
        totalStepsTarget: 10,
        phase: 'choice',
      }
    case 'RESET':
      return {
        players: [],
        currentPlayerIndex: 0,
        stepCount: 0,
        totalStepsTarget: 20,
        phase: 'setup',
        currentChoice: null,
        currentCard: null,
        currentLevel: 1,
        forcedNoRefuse: false,
        shameCardActive: false,
        selectedTags: [],
        usedCardIds: [],
        vote: { enabled: false, votes: {}, result: null },
      }
    default:
      return state
  }
}

const initialState: TDState = {
  players: [],
  currentPlayerIndex: 0,
  stepCount: 0,
  totalStepsTarget: 20,
  phase: 'setup',
  currentChoice: null,
  currentCard: null,
  currentLevel: 1,
  forcedNoRefuse: false,
  shameCardActive: false,
  selectedTags: [],
  usedCardIds: [],
  vote: { enabled: false, votes: {}, result: null },
}

const TDContext = createContext<{
  state: TDState
  dispatch: React.Dispatch<TDAction>
} | null>(null)

export function TruthDareProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(tdReducer, initialState)
  return <TDContext.Provider value={{ state, dispatch }}>{children}</TDContext.Provider>
}

export function useTruthDare() {
  const ctx = useContext(TDContext)
  if (!ctx) throw new Error('useTruthDare must be used within TruthDareProvider')
  return ctx
}
