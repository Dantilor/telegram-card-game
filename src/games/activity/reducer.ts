import type { ActivityState, TaskType, ActivityCategoryId } from './types'
import { getInitialActivityState } from './state'
import { ACTIVITY_CATEGORIES, parseActivityItem } from './data/activityWords'

function getAllItems(categoryIds: ActivityCategoryId[]): string[] {
  const items: string[] = []
  for (const id of categoryIds) {
    const cat = ACTIVITY_CATEGORIES.find((c) => c.id === id)
    if (cat) items.push(...cat.words)
  }
  return items
}

function pickItem(
  categoryIds: ActivityCategoryId[],
  usedWords: string[]
): { word: string; taskType: TaskType; usedWords: string[] } {
  const allItems = getAllItems(categoryIds)
  const available = allItems.filter((item) => !usedWords.includes(item))

  if (available.length === 0) {
    const item = allItems[Math.floor(Math.random() * allItems.length)] ?? ''
    const { word, taskType } = parseActivityItem(item)
    return { word, taskType, usedWords: [item] }
  }

  const item = available[Math.floor(Math.random() * available.length)] ?? ''
  const { word, taskType } = parseActivityItem(item)
  return { word, taskType, usedWords: [...usedWords, item] }
}

export type ActivityAction =
  | { type: 'SET_CATEGORY_IDS'; categoryIds: ActivityCategoryId[] }
  | { type: 'SET_TIMER'; seconds: 30 | 45 | 60 }
  | { type: 'SET_TEAM_COUNT'; count: number }
  | { type: 'SET_TEAM_NAME'; slotIndex: number; name: string }
  | { type: 'ADD_PLAYER'; slotIndex: number; playerName: string }
  | { type: 'REMOVE_PLAYER'; slotIndex: number; playerIndex: number }
  | { type: 'START_GAME' }
  | { type: 'START_ROUND' }
  | { type: 'GUESSED' }
  | { type: 'SKIPPED' }
  | { type: 'END_ROUND' }
  | { type: 'PASS_TURN' }
  | { type: 'START_NEXT_ROUND' }
  | { type: 'NEXT_WORD' }
  | { type: 'RESET_ALL' }

export function activityReducer(state: ActivityState, action: ActivityAction): ActivityState {
  switch (action.type) {
    case 'SET_CATEGORY_IDS':
      return { ...state, categoryIds: action.categoryIds }

    case 'SET_TIMER':
      return { ...state, timerSeconds: action.seconds }

    case 'SET_TEAM_COUNT':
      return { ...state, teamCount: Math.max(2, Math.min(6, action.count)) }

    case 'SET_TEAM_NAME': {
      const teams = [...state.teams]
      const slot = teams[action.slotIndex]
      if (slot) {
        teams[action.slotIndex] = { ...slot, name: action.name }
      }
      return { ...state, teams }
    }

    case 'ADD_PLAYER': {
      const teams = [...state.teams]
      const slot = teams[action.slotIndex]
      if (slot && action.playerName.trim()) {
        teams[action.slotIndex] = {
          ...slot,
          players: [...slot.players, action.playerName.trim()],
        }
      }
      return { ...state, teams }
    }

    case 'REMOVE_PLAYER': {
      const teams = [...state.teams]
      const slot = teams[action.slotIndex]
      if (slot) {
        teams[action.slotIndex] = {
          ...slot,
          players: slot.players.filter((_, i) => i !== action.playerIndex),
        }
      }
      return { ...state, teams }
    }

    case 'START_GAME': {
      const activeSlots: number[] = []
      for (let i = 0; i < state.teamCount; i++) {
        const t = state.teams[i]
        if (t && t.name.trim() && t.players.length >= 2) {
          activeSlots.push(i)
        }
      }
      if (activeSlots.length < 2 || state.categoryIds.length === 0) return state

      return {
        ...state,
        phase: 'turn_ready',
        activeTeamSlots: activeSlots,
        currentTeamIndex: 0,
        teamScores: [0, 0, 0, 0, 0, 0],
        teamGuessed: [0, 0, 0, 0, 0, 0],
        roundNumber: 1,
        usedWords: [],
      }
    }

    case 'START_ROUND': {
      if (state.phase !== 'turn_ready') return state
      const { word, taskType, usedWords } = pickItem(state.categoryIds, state.usedWords)
      return {
        ...state,
        phase: 'in_round',
        roundEndsAt: Date.now() + state.timerSeconds * 1000,
        guessed: 0,
        skipped: 0,
        roundEndFired: false,
        currentWord: word,
        currentTaskType: taskType,
        usedWords,
      }
    }

    case 'GUESSED': {
      if (state.phase !== 'in_round') return state
      const slotIdx = state.activeTeamSlots[state.currentTeamIndex] ?? 0
      const teamScores = [...state.teamScores]
      const teamGuessed = [...state.teamGuessed]
      teamScores[slotIdx] = (teamScores[slotIdx] ?? 0) + 1
      teamGuessed[slotIdx] = (teamGuessed[slotIdx] ?? 0) + 1

      const { word, taskType, usedWords } = pickItem(state.categoryIds, state.usedWords)

      return {
        ...state,
        teamScores,
        teamGuessed,
        guessed: state.guessed + 1,
        currentWord: word,
        currentTaskType: taskType,
        usedWords,
      }
    }

    case 'SKIPPED': {
      if (state.phase !== 'in_round') return state
      const { word, taskType, usedWords } = pickItem(state.categoryIds, state.usedWords)
      return {
        ...state,
        skipped: state.skipped + 1,
        currentWord: word,
        currentTaskType: taskType,
        usedWords,
      }
    }

    case 'END_ROUND': {
      if (state.roundEndFired) return state
      return {
        ...state,
        phase: 'round_results',
        roundEndFired: true,
        roundEndsAt: null,
      }
    }

    case 'PASS_TURN': {
      const nextTeamIndex = state.currentTeamIndex + 1
      const isLastTeam = nextTeamIndex >= state.activeTeamSlots.length
      
      if (isLastTeam) {
        return {
          ...state,
          phase: 'game_over',
          currentTeamIndex: 0,
        }
      }
      
      return {
        ...state,
        phase: 'turn_ready',
        currentTeamIndex: nextTeamIndex,
        guessed: 0,
        skipped: 0,
        roundEndFired: false,
      }
    }

    case 'START_NEXT_ROUND': {
      if (state.phase !== 'game_over') return state
      return {
        ...state,
        phase: 'turn_ready',
        currentTeamIndex: 0,
        roundNumber: state.roundNumber + 1,
        roundEndFired: false,
        guessed: 0,
        skipped: 0,
      }
    }

    case 'NEXT_WORD': {
      const { word, taskType, usedWords } = pickItem(state.categoryIds, state.usedWords)
      return {
        ...state,
        currentWord: word,
        currentTaskType: taskType,
        usedWords,
      }
    }

    case 'RESET_ALL':
      return getInitialActivityState()

    default:
      return state
  }
}
