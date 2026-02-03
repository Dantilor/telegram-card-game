export type Role = 'civilian' | 'mafia' | 'doctor' | 'sheriff'

export type Player = {
  id: string
  name: string
  role: Role
  alive: boolean
}

export type NightAction = {
  mafiaTarget: string | null
  doctorTarget: string | null
  sheriffTarget: string | null
  sheriffResult: boolean | null
}

export type Phase =
  | 'setup'
  | 'roles'
  | 'night_intro'
  | 'night_mafia_intro'
  | 'night_mafia'
  | 'night_doctor_intro'
  | 'night_doctor'
  | 'night_sheriff_intro'
  | 'night_sheriff'
  | 'day'
  | 'voting'
  | 'voting_collect'
  | 'voting_summary'
  | 'result'

export type GameState = {
  players: Player[]
  phase: Phase
  roleViewIndex: number
  nightAction: NightAction
  nightResult: string | null
  discussionSeconds: number
  votes: Record<string, string>
  voteCollectIndex: number
  votingSummaryTargetId: string | null
  winner: 'peaceful' | 'mafia' | null
}

export const ROLE_LABELS: Record<Role, string> = {
  civilian: 'Мирный',
  mafia: 'Мафия',
  doctor: 'Доктор',
  sheriff: 'Шериф',
}
