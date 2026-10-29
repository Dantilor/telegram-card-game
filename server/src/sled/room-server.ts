import { createHash, randomBytes, randomUUID } from 'node:crypto'
import type { PoolClient } from 'pg'
import { pool, query } from '../db.js'
import { playerRoles, roleById, type RoomPayload, type SharedGameState } from './types.js'

const ROOM_LIFETIME_MS = 6 * 60 * 60 * 1000
const ONLINE_WINDOW_MS = 35 * 1000

export class RoomApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

type RoomRow = {
  code: string
  host_participant_id: string
  case_id: string
  mode: string
  status: string
  state: SharedGameState | string
  revision: number
  created_at: Date | string
  updated_at: Date | string
  expires_at: Date | string
}

type ParticipantRow = {
  id: string
  room_code: string
  token_hash: string
  name: string
  role_id: string
  seat: number
  is_host: boolean
  ready: boolean
  vote_round: number | null
  vote_district: string | null
  ability_used: boolean
  joined_at: Date | string
  last_seen_at: Date | string
}

type EventRow = {
  id: string | number
  room_code: string
  participant_id: string
  kind: string
  payload: Record<string, unknown> | string
  created_at: Date | string
  participant_name: string | null
  role_id: string | null
}

function asIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function parseState(raw: SharedGameState | string | null): SharedGameState | null {
  if (!raw) return null
  if (typeof raw === 'object') return raw
  try {
    return JSON.parse(raw) as SharedGameState
  } catch {
    return null
  }
}

function parsePayload(raw: Record<string, unknown> | string): Record<string, unknown> {
  if (raw && typeof raw === 'object') return raw
  try {
    return JSON.parse(String(raw || '{}')) as Record<string, unknown>
  } catch {
    return {}
  }
}

export function cleanName(value: unknown) {
  if (typeof value !== 'string') throw new RoomApiError(400, 'Введите имя игрока.')
  const name = value.replace(/\s+/g, ' ').trim().slice(0, 24)
  if (name.length < 2) throw new RoomApiError(400, 'Имя должно содержать минимум 2 символа.')
  return name
}

export function cleanCode(value: unknown) {
  const code = String(value ?? '').replace(/\D/g, '')
  if (!/^\d{6}$/.test(code)) throw new RoomApiError(400, 'Код комнаты состоит из 6 цифр.')
  return code
}

export function createToken() {
  return randomBytes(24).toString('hex')
}

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function roomCode() {
  return String(100000 + (randomBytes(4).readUInt32BE(0) % 900000))
}

export function expiresAt() {
  return new Date(Date.now() + ROOM_LIFETIME_MS).toISOString()
}

export function validCaseId(value: unknown): value is string {
  return typeof value === 'string' && /^(0[1-9]|10)$/.test(value)
}

export function validMode(value: unknown): value is 'story' | 'operative' {
  return value === 'story' || value === 'operative'
}

export function validateSharedState(value: unknown): SharedGameState {
  if (!value || typeof value !== 'object') throw new RoomApiError(400, 'Состояние игры повреждено.')
  const state = value as Partial<SharedGameState>
  if (!Number.isInteger(state.roundIndex) || (state.roundIndex ?? -1) < 0 || (state.roundIndex ?? 4) > 3) {
    throw new RoomApiError(400, 'Некорректный номер сцены.')
  }
  if (typeof state.threat !== 'number' || typeof state.timeLeft !== 'number') {
    throw new RoomApiError(400, 'Некорректные показатели дела.')
  }
  return value as SharedGameState
}

export async function clearExpiredRooms() {
  await query(`DELETE FROM sled_rooms WHERE expires_at < NOW()`)
}

export async function getRoomByCode(code: string, client?: PoolClient) {
  const sql = `SELECT code, host_participant_id, case_id, mode, status, state, revision, created_at, updated_at, expires_at
     FROM sled_rooms WHERE code = $1 LIMIT 1`
  const params = [code]
  const result = client
    ? await client.query<RoomRow>(sql, params)
    : await query<RoomRow>(sql, params)
  return result.rows[0] ?? null
}

export async function authenticate(codeValue: unknown, token: string) {
  const code = cleanCode(codeValue)
  const tokenHash = hashToken(token)
  const room = await getRoomByCode(code)
  if (!room || new Date(asIso(room.expires_at)).getTime() < Date.now()) {
    throw new RoomApiError(404, 'Комната не найдена или уже закрыта.')
  }
  const result = await query<ParticipantRow>(
    `SELECT id, room_code, token_hash, name, role_id, seat, is_host, ready, vote_round, vote_district, ability_used, joined_at, last_seen_at
     FROM sled_participants WHERE room_code = $1 AND token_hash = $2 LIMIT 1`,
    [code, tokenHash],
  )
  const row = result.rows[0]
  if (!row) throw new RoomApiError(401, 'Ключ игрока не подходит к этой комнате.')
  return { room, participant: row }
}

export async function touchParticipant(id: string) {
  await query(`UPDATE sled_participants SET last_seen_at = NOW() WHERE id = $1`, [id])
}

export async function serializeRoom(code: string, requesterId: string): Promise<RoomPayload> {
  const room = await getRoomByCode(code)
  if (!room) throw new RoomApiError(404, 'Комната не найдена.')

  const [playersResult, eventsResult] = await Promise.all([
    query<ParticipantRow>(
      `SELECT id, room_code, token_hash, name, role_id, seat, is_host, ready, vote_round, vote_district, ability_used, joined_at, last_seen_at
       FROM sled_participants WHERE room_code = $1 ORDER BY seat ASC`,
      [code],
    ),
    query<EventRow>(
      `SELECT e.id, e.room_code, e.participant_id, e.kind, e.payload, e.created_at, p.name AS participant_name, p.role_id AS role_id
       FROM sled_room_events e
       LEFT JOIN sled_participants p ON p.id = e.participant_id
       WHERE e.room_code = $1
       ORDER BY e.id DESC
       LIMIT 40`,
      [code],
    ),
  ])

  const playerRows = playersResult.rows
  const requester = playerRows.find((player) => player.id === requesterId)
  if (!requester) throw new RoomApiError(401, 'Игрок больше не состоит в комнате.')

  const onlineAfter = Date.now() - ONLINE_WINDOW_MS
  const publicPlayers = playerRows.map((player) => ({
    id: player.id,
    name: player.name,
    seat: player.seat,
    isHost: Boolean(player.is_host),
    ready: Boolean(player.ready),
    abilityUsed: Boolean(player.ability_used),
    online: new Date(asIso(player.last_seen_at)).getTime() >= onlineAfter,
    voteRound: player.vote_round,
    voteDistrict: player.vote_district,
  }))

  const mePublic = publicPlayers.find((player) => player.id === requesterId)!
  const events = eventsResult.rows
    .slice()
    .reverse()
    .map((event) => {
      const payload = { ...parsePayload(event.payload) }
      const ownAbility = event.kind === 'ability' && event.participant_id === requesterId
      if (!ownAbility) delete payload.roleId
      return {
        id: Number(event.id),
        kind: event.kind as RoomPayload['events'][number]['kind'],
        participantId: event.participant_id,
        participantName: event.participant_name ?? 'Игрок',
        roleId: ownAbility ? (event.role_id ?? 'operative') : '',
        payload,
        createdAt: asIso(event.created_at),
      }
    })

  return {
    code: room.code,
    caseId: room.case_id,
    mode: room.mode as RoomPayload['mode'],
    status: room.status as RoomPayload['status'],
    revision: room.revision,
    state: parseState(room.state),
    players: publicPlayers,
    me: { ...mePublic, roleId: requester.role_id },
    events,
    updatedAt: asIso(room.updated_at),
  }
}

export async function createRoomWithHost(input: {
  name: string
  caseId: string
  mode: string
  state: SharedGameState
}) {
  const participantId = randomUUID()
  const token = createToken()
  const tokenHash = hashToken(token)

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    let code = ''
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const candidate = roomCode()
      const existing = await getRoomByCode(candidate, client)
      if (!existing) {
        code = candidate
        break
      }
    }
    if (!code) throw new Error('Could not allocate room code')

    await client.query(
      `INSERT INTO sled_rooms (code, host_participant_id, case_id, mode, status, state, expires_at)
       VALUES ($1, $2, $3, $4, 'lobby', $5::jsonb, $6)`,
      [code, participantId, input.caseId, input.mode, JSON.stringify(input.state), expiresAt()],
    )
    await client.query(
      `INSERT INTO sled_participants (id, room_code, token_hash, name, role_id, seat, is_host, ready)
       VALUES ($1, $2, $3, $4, 'operative', 0, TRUE, TRUE)`,
      [participantId, code, tokenHash, input.name],
    )
    await client.query('COMMIT')
    return { code, token, participantId, isHost: true as const }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function joinRoom(code: string, name: string) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const roomResult = await client.query<RoomRow>(
      `SELECT code, host_participant_id, case_id, mode, status, state, revision, created_at, updated_at, expires_at
       FROM sled_rooms WHERE code = $1 FOR UPDATE`,
      [code],
    )
    const room = roomResult.rows[0]
    if (!room || new Date(asIso(room.expires_at)).getTime() < Date.now()) {
      throw new RoomApiError(404, 'Комната не найдена или уже закрыта.')
    }
    if (room.status !== 'lobby') {
      throw new RoomApiError(409, 'Расследование уже началось. Попросите ведущего создать новую комнату.')
    }

    const names = await client.query<{ name: string }>(
      `SELECT name FROM sled_participants WHERE room_code = $1`,
      [code],
    )
    if (names.rows.some((row) => row.name.toLocaleLowerCase('ru') === name.toLocaleLowerCase('ru'))) {
      throw new RoomApiError(409, 'Игрок с таким именем уже в комнате.')
    }

    const seats = await client.query<{ seat: number }>(
      `SELECT seat FROM sled_participants WHERE room_code = $1 ORDER BY seat ASC`,
      [code],
    )
    if (seats.rows.length >= 8) throw new RoomApiError(409, 'В комнате уже 8 игроков.')
    const occupied = new Set(seats.rows.map((row) => row.seat))
    let seat = 0
    while (occupied.has(seat)) seat += 1
    const roleId = playerRoles[seat % playerRoles.length].id

    const participantId = randomUUID()
    const token = createToken()
    await client.query(
      `INSERT INTO sled_participants (id, room_code, token_hash, name, role_id, seat, is_host, ready)
       VALUES ($1, $2, $3, $4, $5, $6, FALSE, FALSE)`,
      [participantId, code, hashToken(token), name, roleId, seat],
    )
    await client.query('COMMIT')
    return { code, token, participantId, isHost: false as const }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function patchRoom(code: string, hostId: string, status: string, state: SharedGameState) {
  const result = await query(
    `UPDATE sled_rooms
     SET status = $1,
         state = $2::jsonb,
         revision = revision + 1,
         updated_at = NOW()
     WHERE code = $3 AND host_participant_id = $4
     RETURNING code`,
    [status, JSON.stringify(state), code, hostId],
  )
  if (!result.rowCount) throw new RoomApiError(403, 'Только ведущий управляет сценой.')
}

export async function setReady(participantId: string, ready: boolean) {
  await query(`UPDATE sled_participants SET ready = $1, last_seen_at = NOW() WHERE id = $2`, [
    ready,
    participantId,
  ])
}

export async function setVote(participantId: string, roundIndex: number, district: string) {
  await query(
    `UPDATE sled_participants SET vote_round = $1, vote_district = $2, last_seen_at = NOW() WHERE id = $3`,
    [roundIndex, district, participantId],
  )
}

export async function claimAbility(roomCode: string, participant: ParticipantRow, roundIndex: number) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const claimed = await client.query<{ id: string }>(
      `UPDATE sled_participants
       SET ability_used = TRUE, last_seen_at = NOW()
       WHERE id = $1 AND ability_used = FALSE
       RETURNING id`,
      [participant.id],
    )
    if (!claimed.rows[0]) throw new RoomApiError(409, 'Способность уже использована.')
    const role = roleById(participant.role_id)
    await client.query(
      `INSERT INTO sled_room_events (room_code, participant_id, kind, payload)
       VALUES ($1, $2, 'ability', $3::jsonb)`,
      [
        roomCode,
        participant.id,
        JSON.stringify({ roleId: role.id, effect: role.effect, roundIndex }),
      ],
    )
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export function getPlayerToken(headerValue: unknown) {
  const token = typeof headerValue === 'string' ? headerValue.trim() : ''
  if (!token) throw new RoomApiError(401, 'Сессия игрока не найдена.')
  return token
}
