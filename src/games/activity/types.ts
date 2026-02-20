export type TaskType = 'explain' | 'show' | 'draw'

export const TASK_LABELS: Record<TaskType, string> = {
  explain: 'ОБЪЯСНИ',
  show: 'ПОКАЖИ',
  draw: 'НАРИСУЙ',
}

export type ActivityTeamSlot = {
  name: string
  players: string[]
}

export type ActivityPhase = 'setup' | 'turn_ready' | 'in_round' | 'round_results' | 'game_over'

export type ActivityCategoryId = 'emotions' | 'behaviors' | 'characters' | 'lifeSituations' | 'awkwardMoments' | 'communication' | 'scenes'

export type ActivityState = {
  categoryIds: ActivityCategoryId[]
  timerSeconds: 30 | 45 | 60
  teams: ActivityTeamSlot[]
  teamCount: number
  phase: ActivityPhase
  currentTeamIndex: number
  activeTeamSlots: number[]
  teamScores: number[]
  teamGuessed: number[]
  roundEndsAt: number | null
  guessed: number
  skipped: number
  roundEndFired: boolean
  currentWord: string
  currentTaskType: TaskType
  usedWords: string[]
  roundNumber: number
}

export function getActiveTeams(state: ActivityState): ActivityTeamSlot[] {
  if (state.activeTeamSlots.length === 0) return []
  return state.activeTeamSlots.map((i) => state.teams[i]!).filter(Boolean)
}

export function getCurrentTeam(state: ActivityState): ActivityTeamSlot | null {
  const active = getActiveTeams(state)
  const idx = state.currentTeamIndex % Math.max(1, active.length)
  return active[idx] ?? null
}

export function getCurrentTeamSlotIndex(state: ActivityState): number {
  if (state.activeTeamSlots.length === 0) return 0
  return state.activeTeamSlots[state.currentTeamIndex % state.activeTeamSlots.length] ?? 0
}
