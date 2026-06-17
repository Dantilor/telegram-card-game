export type Role = 'civilian' | 'mafia' | 'doctor' | 'sheriff'

/** Для мирных: 0 или 1 — какой портрет показывать (рандом при старте). */
export type Player = {
  id: string
  name: string
  role: Role
  alive: boolean
  /** Только у civilian: индекс картинки мирного (0 или 1). */
  civilianImageIndex?: 0 | 1
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
  | 'round_summary'
  | 'result'

export type GameState = {
  players: Player[]
  hostName: string
  roundNumber: number
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

/** Exhaustive check for phase in switch — TypeScript error if a phase is missed. */
export function assertNeverPhase(value: never): never {
  throw new Error(`Unknown phase: ${value}`)
}
