export type SabotageRole = 'player' | 'saboteur'

export type SabotagePlayer = {
  id: string
  name: string
  role: SabotageRole
}

export type SabotagePhase = 'setup' | 'role' | 'task' | 'vote' | 'result'

export type SabotageState = {
  players: SabotagePlayer[]
  phase: SabotagePhase
  roleViewIndex: number
  task: string
  taskDurationSeconds: number
  votes: Record<string, string>
  voteCollectIndex: number
  saboteurId: string | null
  winner: 'team' | 'saboteur' | null
}

export const ROLE_LABELS: Record<SabotageRole, string> = {
  player: 'Обычная роль',
  saboteur: 'Саботёр',
}
