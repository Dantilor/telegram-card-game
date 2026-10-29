export type RoleEffect =
  | 'eliminate_district'
  | 'reveal_detail'
  | 'extra_time'
  | 'free_hint'
  | 'reduce_threat'

export type PlayerRole = {
  id: string
  effect: RoleEffect
}

/** Seat → role contract mirrored from the SLED client. */
export const playerRoles: PlayerRole[] = [
  { id: 'operative', effect: 'eliminate_district' },
  { id: 'analyst', effect: 'reveal_detail' },
  { id: 'observer', effect: 'eliminate_district' },
  { id: 'signaler', effect: 'extra_time' },
  { id: 'archivist', effect: 'free_hint' },
  { id: 'cryptographer', effect: 'reduce_threat' },
  { id: 'coordinator', effect: 'extra_time' },
  { id: 'profiler', effect: 'reduce_threat' },
]

export function roleById(roleId: string) {
  return playerRoles.find((role) => role.id === roleId) ?? playerRoles[0]
}

export type SharedGameState = {
  roundIndex: number
  signalOpen: boolean
  resolved: boolean
  lastCorrect: boolean | null
  threat: number
  score: number
  timeLeft: number
  timerDeadline?: number | null
  analystRounds?: number[]
  analysisByRound: Record<number, number[]>
  hintsUsed: number[]
  eliminatedDistricts: string[]
  deductionsSolved: number[]
  casePoints: number
  finalChoice: string | null
  networkFailed: boolean
  processedAbilityEventIds: number[]
}

export type PublicParticipant = {
  id: string
  name: string
  seat: number
  isHost: boolean
  ready: boolean
  abilityUsed: boolean
  online: boolean
  voteRound: number | null
  voteDistrict: string | null
}

export type RoomEvent = {
  id: number
  kind: 'ability' | 'system'
  participantId: string
  participantName: string
  roleId: string
  payload: Record<string, unknown>
  createdAt: string
}

export type RoomPayload = {
  code: string
  caseId: string
  mode: 'story' | 'operative'
  status: 'lobby' | 'roles' | 'game' | 'final' | 'ended'
  revision: number
  state: SharedGameState | null
  players: PublicParticipant[]
  me: PublicParticipant & { roleId: string }
  events: RoomEvent[]
  updatedAt: string
}

export type RoomSession = {
  code: string
  token: string
  participantId: string
  isHost: boolean
}
