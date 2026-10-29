import { Router, type Request, type Response } from 'express'
import type { PoolClient } from 'pg'
import { pool } from '../db.js'
import { verifyInitData } from '../telegram/verifyInitData.js'
import { getUserPremiumWithDb } from '../premiumStore.js'
import {
  CITY_EVENTS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  ROLE_META,
  type CityEventKey,
  type Phase,
  type Role,
  type Team,
} from '../mafia-shadows/mafia.js'
import { mafiaWinner, maniacTieWinner, missingNightActors } from '../party/partyRules.js'

type RoomRow = {
  id: string
  code: string
  host_token: string
  phase: Phase
  round: number
  phase_ends_at: string | number | null
  event_key: CityEventKey
  public_message: string
  winner: Team | null
  created_at: string | number
  updated_at: string | number
}
type PlayerRow = {
  id: string
  room_id: string
  token: string
  name: string
  avatar: number
  is_host: boolean
  alive: boolean
  role: Role | null
  team: Team | null
  revealed: boolean
  private_note: string
  joined_at: string | number
}
type ActionRow = {
  id: string
  room_id: string
  round: number
  phase: Phase
  player_id: string
  action_kind: string
  target_player_id: string
  created_at: string | number
}
type EventRow = {
  id: string
  room_id: string
  round: number
  kind: string
  message: string
  created_at: string | number
}
type Body = {
  action?: string
  code?: string
  name?: string
  token?: string
  hostToken?: string
  targetId?: string
}

class ApiError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

const EVENT_KEYS = Object.keys(CITY_EVENTS) as CityEventKey[]
const NIGHT_ROLES = new Set<Role>(['don', 'mafia', 'detective', 'doctor', 'maniac'])

function send(res: Response, data: unknown, status = 200) {
  res.setHeader('Cache-Control', 'no-store')
  res.status(status).json(data)
}
function fail(message: string, status = 400): never {
  throw new ApiError(message, status)
}
function codeOf(value?: string) {
  return (value ?? '').replace(/\D/g, '').slice(0, 6)
}
function nameOf(value?: string) {
  return (value ?? '').trim().replace(/\s+/g, ' ').slice(0, 18)
}
function now() {
  return Date.now()
}
function randomIndex(max: number) {
  return crypto.getRandomValues(new Uint32Array(1))[0] % max
}
function shuffle<T>(items: T[]) {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = randomIndex(i + 1)
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}
function rolesFor(count: number): Role[] {
  const mafiaCount = count >= 11 ? 3 : count >= 7 ? 2 : 1
  const roles: Role[] = ['don']
  for (let i = 1; i < mafiaCount; i += 1) roles.push('mafia')
  roles.push('detective', 'doctor')
  if (count >= 5) roles.push('maniac')
  while (roles.length < count) roles.push('citizen')
  return shuffle(roles)
}
function eventFor(round: number): CityEventKey {
  return EVENT_KEYS[(round - 1) % EVENT_KEYS.length]
}
function roleAction(role: Role | null, phase: Phase) {
  if (phase === 'vote') return 'lynch'
  if (phase !== 'night') return null
  if (role === 'don' || role === 'mafia') return 'kill'
  if (role === 'detective') return 'investigate'
  if (role === 'doctor') return 'protect'
  if (role === 'maniac') return 'solo_kill'
  return null
}
function winnerFor(players: PlayerRow[]): Team | 'mutual' | null {
  return mafiaWinner(players)
}
function winnerMessage(winner: Team) {
  return winner === 'city'
    ? 'Город выстоял. Все преступники разоблачены.'
    : winner === 'mafia'
      ? 'Мафия захватила город. Больше некому ей сопротивляться.'
      : 'Одиночка пережил всех. У города не осталось союзников.'
}
function num(value: string | number | null) {
  if (value == null) return null
  return typeof value === 'number' ? value : Number(value)
}

async function withClient<T>(fn: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect()
  try {
    return await fn(client)
  } finally {
    client.release()
  }
}

async function withTx<T>(fn: (client: PoolClient) => Promise<T>) {
  return withClient(async (client) => {
    await client.query('BEGIN')
    try {
      const result = await fn(client)
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }
  })
}

async function lockRoom(client: PoolClient, code: string) {
  const found = await client.query<RoomRow>('SELECT * FROM mafia_rooms WHERE code = $1 FOR UPDATE', [code])
  return found.rows[0] ?? null
}
async function findRoom(client: PoolClient, code: string) {
  const found = await client.query<RoomRow>('SELECT * FROM mafia_rooms WHERE code = $1 LIMIT 1', [code])
  return found.rows[0] ?? null
}
async function roomPlayers(client: PoolClient, roomId: string) {
  const found = await client.query<PlayerRow>(
    'SELECT * FROM mafia_players WHERE room_id = $1 ORDER BY joined_at ASC',
    [roomId],
  )
  return found.rows
}
async function turnActions(client: PoolClient, room: RoomRow) {
  const found = await client.query<ActionRow>(
    'SELECT * FROM mafia_actions WHERE room_id = $1 AND round = $2 AND phase = $3 ORDER BY created_at ASC',
    [room.id, room.round, room.phase],
  )
  return found.rows
}
async function latestEvents(client: PoolClient, roomId: string) {
  const found = await client.query<EventRow>(
    'SELECT * FROM mafia_events WHERE room_id = $1 ORDER BY id DESC LIMIT 6',
    [roomId],
  )
  return found.rows.reverse()
}

async function callerIsPremium(req: Request) {
  const raw = req.headers['x-telegram-init-data']
  const initData = typeof raw === 'string' ? raw.trim() : ''
  if (!initData) return false
  const botToken = process.env.TELEGRAM_BOT_TOKEN ?? process.env.BOT_TOKEN ?? ''
  if (!botToken) return false
  try {
    const parsed = verifyInitData(initData, botToken)
    const status = await getUserPremiumWithDb(parsed.telegram_id)
    return status.premium
  } catch {
    return false
  }
}

async function createRoom(req: Request, rawName?: string) {
  if (!(await callerIsPremium(req))) fail('Создать комнату можно только с Premium.', 403)
  const name = nameOf(rawName)
  if (name.length < 2) fail('Введите имя — минимум 2 символа.')
  return withTx(async (client) => {
    let code = ''
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const candidate = String(100000 + randomIndex(900000))
      if (!(await findRoom(client, candidate))) {
        code = candidate
        break
      }
    }
    if (!code) fail('Не удалось создать код комнаты. Попробуйте ещё раз.', 503)
    const roomId = crypto.randomUUID()
    const playerId = crypto.randomUUID()
    const token = crypto.randomUUID()
    const hostToken = crypto.randomUUID()
    const timestamp = now()
    await client.query(
      `INSERT INTO mafia_rooms (id, code, host_token, phase, round, event_key, public_message, created_at, updated_at)
       VALUES ($1, $2, $3, 'lobby', 0, 'rain', $4, $5, $6)`,
      [roomId, code, hostToken, 'Соберите от 4 до 14 игроков.', timestamp, timestamp],
    )
    await client.query(
      `INSERT INTO mafia_players (id, room_id, token, name, avatar, is_host, alive, revealed, joined_at)
       VALUES ($1, $2, $3, $4, $5, true, true, false, $6)`,
      [playerId, roomId, token, name, randomIndex(8), timestamp],
    )
    return { status: 201, body: { code, token, hostToken } }
  })
}

async function joinRoom(rawCode?: string, rawName?: string) {
  const code = codeOf(rawCode)
  const name = nameOf(rawName)
  if (code.length !== 6) fail('Введите 6 цифр кода комнаты.')
  if (name.length < 2) fail('Введите имя — минимум 2 символа.')
  return withTx(async (client) => {
    const room = await lockRoom(client, code)
    if (!room) fail('Комната с таким кодом не найдена.', 404)
    if (room.phase !== 'lobby') fail('Партия уже началась. Дождитесь следующей игры.', 409)
    const players = await roomPlayers(client, room.id)
    if (players.length >= MAX_PLAYERS) fail('В комнате уже 14 игроков.', 409)
    if (players.some((p) => p.name.toLocaleLowerCase('ru') === name.toLocaleLowerCase('ru'))) {
      fail('Такое имя уже занято в этой комнате.', 409)
    }
    const id = crypto.randomUUID()
    const token = crypto.randomUUID()
    await client.query(
      `INSERT INTO mafia_players (id, room_id, token, name, avatar, is_host, alive, revealed, joined_at)
       VALUES ($1, $2, $3, $4, $5, false, true, false, $6)`,
      [id, room.id, token, name, randomIndex(8), now()],
    )
    return { status: 201, body: { code, token } }
  })
}

async function requireContext(client: PoolClient, body: Body, lock: boolean) {
  const room = lock ? await lockRoom(client, codeOf(body.code)) : await findRoom(client, codeOf(body.code))
  if (!room) fail('Комната не найдена.', 404)
  const players = await roomPlayers(client, room.id)
  const self = players.find((p) => p.token === (body.token ?? ''))
  if (!self) fail('Это устройство не подключено к комнате.', 401)
  return { room, players, self }
}
function isHost(room: RoomRow, self: PlayerRow, body: Body) {
  return Boolean(self.is_host && body.hostToken && body.hostToken === room.host_token)
}

async function gameState(code: string, token: string, hostToken?: string | null) {
  return withClient(async (client) => {
    const room = await findRoom(client, code)
    if (!room) fail('Комната не найдена.', 404)
    const players = await roomPlayers(client, room.id)
    const self = players.find((p) => p.token === token)
    if (!self) fail('Это устройство не подключено к комнате.', 401)
    const actions = room.phase === 'night' || room.phase === 'vote' ? await turnActions(client, room) : []
    const events = await latestEvents(client, room.id)
    const host = Boolean(hostToken && hostToken === room.host_token && self.is_host)
    const mafiaSelf = self.team === 'mafia'
    const actionByPlayer = new Map(actions.map((a) => [a.player_id, a]))
    const alivePlayers = players.filter((p) => p.alive)
    const required =
      room.phase === 'night'
        ? alivePlayers.filter((p) => p.role && NIGHT_ROLES.has(p.role)).length
        : room.phase === 'vote' || room.phase === 'discussion'
          ? alivePlayers.length
          : room.phase === 'reveal'
            ? players.length
            : 0
    const completed =
      room.phase === 'reveal'
        ? players.filter((p) => p.revealed).length
        : room.phase === 'discussion'
          ? alivePlayers.filter((p) => p.revealed).length
          : actions.length
    return {
      status: 200,
      body: {
        room: {
          code: room.code,
          phase: room.phase,
          round: room.round,
          phaseEndsAt: num(room.phase_ends_at),
          eventKey: room.event_key,
          publicMessage: room.public_message,
          winner: room.winner,
        },
        self: {
          id: self.id,
          name: self.name,
          avatar: self.avatar,
          alive: self.alive,
          role: self.role,
          team: self.team,
          revealed: self.revealed,
          privateNote: self.private_note,
          hasActed: room.phase === 'discussion' ? Boolean(self.revealed) : actionByPlayer.has(self.id),
          isHost: host,
        },
        players: players.map((p) => ({
          id: p.id,
          name: p.name,
          avatar: p.avatar,
          alive: p.alive,
          isHost: p.is_host,
          ready:
            room.phase === 'reveal'
              ? p.revealed
              : room.phase === 'vote'
                ? actionByPlayer.has(p.id)
                : room.phase === 'discussion'
                  ? Boolean(p.alive && p.revealed)
                  : false,
          role:
            room.phase === 'finished' || !p.alive || p.id === self.id || (mafiaSelf && p.team === 'mafia')
              ? p.role
              : null,
          team:
            room.phase === 'finished' || !p.alive || p.id === self.id || (mafiaSelf && p.team === 'mafia')
              ? p.team
              : null,
        })),
        progress: { completed, required },
        events: events.map((e) => ({
          id: Number(e.id),
          round: e.round,
          kind: e.kind,
          message: e.message,
          createdAt: num(e.created_at),
        })),
      },
    }
  })
}

async function startGame(body: Body) {
  return withTx(async (client) => {
    const { room, players, self } = await requireContext(client, body, true)
    if (!isHost(room, self, body)) fail('Только создатель комнаты может начать игру.', 403)
    if (room.phase !== 'lobby') fail('Игра уже началась.', 409)
    if (players.length < MIN_PLAYERS) fail(`Нужно ещё ${MIN_PLAYERS - players.length} игрока.`)
    const roles = rolesFor(players.length)
    const timestamp = now()
    for (let i = 0; i < players.length; i += 1) {
      await client.query(
        'UPDATE mafia_players SET role = $1, team = $2, alive = true, revealed = false, private_note = $3 WHERE id = $4',
        [roles[i], ROLE_META[roles[i]].team, '', players[i].id],
      )
    }
    await client.query(
      `UPDATE mafia_rooms
       SET phase = 'reveal', round = 1, phase_ends_at = NULL, event_key = $1, public_message = $2, winner = NULL, updated_at = $3
       WHERE id = $4`,
      [eventFor(1), 'У каждого появилась тайная роль. Не показывайте экран соседям.', timestamp, room.id],
    )
    await client.query(
      'INSERT INTO mafia_events (room_id, round, kind, message, created_at) VALUES ($1, 1, $2, $3, $4)',
      [room.id, 'start', 'Город заселён. Среди жителей уже скрываются Тени.', timestamp],
    )
    return { status: 200, body: { ok: true } }
  })
}

async function acknowledgeRole(body: Body) {
  return withTx(async (client) => {
    const ctx = await requireContext(client, body, true)
    if (ctx.room.phase !== 'reveal' && ctx.room.phase !== 'discussion') fail('Сейчас подтверждение не требуется.', 409)
    if (ctx.room.phase === 'discussion' && !ctx.self.alive) fail('Вы выбыли и только наблюдаете за обсуждением.', 409)
    await client.query('UPDATE mafia_players SET revealed = true WHERE id = $1', [ctx.self.id])
    return { status: 200, body: { ok: true } }
  })
}

async function submitTurnAction(body: Body) {
  return withTx(async (client) => {
    const { room, players, self } = await requireContext(client, body, true)
    if (!self.alive) fail('Вы выбыли и теперь наблюдаете за городом.', 409)
    if (room.phase !== 'night' && room.phase !== 'vote') fail('Сейчас действие недоступно.', 409)
    const target = players.find((p) => p.id === body.targetId && p.alive)
    if (!target) fail('Выберите живого игрока.')
    const kind = roleAction(self.role, room.phase)
    if (!kind) fail('У вашей роли сейчас нет тайного действия.', 409)
    if (
      (kind === 'kill' && target.team === 'mafia') ||
      (['investigate', 'solo_kill', 'lynch'].includes(kind) && target.id === self.id)
    ) {
      fail('Этого игрока нельзя выбрать.')
    }
    await client.query(
      `INSERT INTO mafia_actions (room_id, round, phase, player_id, action_kind, target_player_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (room_id, round, phase, player_id)
       DO UPDATE SET action_kind = EXCLUDED.action_kind, target_player_id = EXCLUDED.target_player_id, created_at = EXCLUDED.created_at`,
      [room.id, room.round, room.phase, self.id, kind, target.id, now()],
    )
    return { status: 200, body: { ok: true } }
  })
}

function chooseMafiaTarget(actions: ActionRow[], players: PlayerRow[]) {
  const ids = new Set(players.filter((p) => p.alive && p.team === 'mafia').map((p) => p.id))
  const votes = actions.filter((a) => a.action_kind === 'kill' && ids.has(a.player_id))
  if (!votes.length) return null
  const counts = new Map<string, number>()
  votes.forEach((v) => counts.set(v.target_player_id, (counts.get(v.target_player_id) ?? 0) + 1))
  const max = Math.max(...counts.values())
  const leaders = [...counts].filter(([, n]) => n === max).map(([id]) => id)
  if (leaders.length === 1) return leaders[0]
  const don = players.find((p) => p.alive && p.role === 'don')
  const donVote = votes.find((v) => v.player_id === don?.id)?.target_player_id
  return donVote && leaders.includes(donVote) ? donVote : leaders[0]
}

async function resolveNight(client: PoolClient, room: RoomRow, players: PlayerRow[]) {
  const actions = await turnActions(client, room)
  const protectedIds = new Set(actions.filter((a) => a.action_kind === 'protect').map((a) => a.target_player_id))
  const victims = new Set<string>()
  const mafiaTarget = chooseMafiaTarget(actions, players)
  const soloTarget = actions.find((a) => a.action_kind === 'solo_kill')?.target_player_id
  if (mafiaTarget && !protectedIds.has(mafiaTarget)) victims.add(mafiaTarget)
  if (soloTarget && !protectedIds.has(soloTarget)) victims.add(soloTarget)
  for (const action of actions.filter((a) => a.action_kind === 'investigate')) {
    const target = players.find((p) => p.id === action.target_player_id)
    if (!target) continue
    await client.query('UPDATE mafia_players SET private_note = $1 WHERE id = $2', [
      `Проверка: ${target.name} — ${target.team === 'mafia' ? 'СВЯЗАН С МАФИЕЙ' : 'НЕ ИЗ МАФИИ'}.`,
      action.player_id,
    ])
  }
  for (const id of victims) {
    await client.query('UPDATE mafia_players SET alive = false WHERE id = $1', [id])
  }
  const after = players.map((p) => ({ ...p, alive: victims.has(p.id) ? false : p.alive }))
  const victimPlayers = players.filter((p) => victims.has(p.id))
  const message = victimPlayers.length
    ? `На рассвете город потерял: ${victimPlayers.map((p) => `${p.name} — ${p.role ? ROLE_META[p.role].title : 'неизвестный'}`).join(', ')}.`
    : 'Рассвет наступил без жертв. Кто-то сорвал ночной план.'
  const winner = winnerFor(after)
  const timestamp = now()
  const finished = winner === 'city' || winner === 'mafia' || winner === 'neutral' || winner === 'mutual'
  const finalMessage =
    winner === 'mutual'
      ? 'Ночные удары скрестились. Последним не остался никто.'
      : winner
        ? winnerMessage(winner)
        : message
  if (!finished) await client.query('UPDATE mafia_players SET revealed = false WHERE room_id = $1', [room.id])
  await client.query(
    `UPDATE mafia_rooms SET phase = $1, phase_ends_at = $2, public_message = $3, winner = $4, updated_at = $5 WHERE id = $6`,
    [
      finished ? 'finished' : 'discussion',
      finished ? null : timestamp + 120000,
      finalMessage,
      winner === 'mutual' ? null : winner,
      timestamp,
      room.id,
    ],
  )
  await client.query(
    'INSERT INTO mafia_events (room_id, round, kind, message, created_at) VALUES ($1, $2, $3, $4, $5)',
    [room.id, room.round, winner ? 'finish' : 'dawn', finalMessage, timestamp],
  )
}

async function resolveVote(client: PoolClient, room: RoomRow, players: PlayerRow[]) {
  const actions = (await turnActions(client, room)).filter((a) => a.action_kind === 'lynch')
  const counts = new Map<string, number>()
  actions.forEach((a) => counts.set(a.target_player_id, (counts.get(a.target_player_id) ?? 0) + 1))
  let eliminated: PlayerRow | null = null
  if (counts.size) {
    const max = Math.max(...counts.values())
    const leaders = [...counts].filter(([, n]) => n === max)
    if (leaders.length === 1) eliminated = players.find((p) => p.id === leaders[0][0]) ?? null
  }
  if (eliminated) await client.query('UPDATE mafia_players SET alive = false WHERE id = $1', [eliminated.id])
  const after = players.map((p) => ({ ...p, alive: eliminated?.id === p.id ? false : p.alive }))
  const tieWinner = maniacTieWinner(after, Boolean(eliminated))
  const verdict = eliminated
    ? `Город изгнал ${eliminated.name}. Роль раскрыта: ${eliminated.role ? ROLE_META[eliminated.role].title : 'неизвестно'}.`
    : tieWinner
      ? 'Одиночка не остался последним. Противник пережил ночь, а голоса разделились.'
      : 'Голоса разделились. Сегодня город никого не изгнал.'
  const outcome = winnerFor(after)
  const storedWinner: Team | null = outcome === 'mutual' ? null : (outcome ?? tieWinner)
  const finished = outcome === 'mutual' || storedWinner != null
  const nextRound = room.round + 1
  const timestamp = now()
  const finalMessage =
    outcome === 'mutual'
      ? 'Ночные удары скрестились. Последним не остался никто.'
      : storedWinner
        ? winnerMessage(storedWinner)
        : verdict
  await client.query(
    `UPDATE mafia_rooms
     SET phase = $1, round = $2, phase_ends_at = $3, event_key = $4, public_message = $5, winner = $6, updated_at = $7
     WHERE id = $8`,
    [
      finished ? 'finished' : 'night',
      finished ? room.round : nextRound,
      finished ? null : timestamp + 90000,
      eventFor(nextRound),
      finalMessage,
      storedWinner,
      timestamp,
      room.id,
    ],
  )
  await client.query(
    'INSERT INTO mafia_events (room_id, round, kind, message, created_at) VALUES ($1, $2, $3, $4, $5)',
    [room.id, room.round, finished ? 'finish' : 'verdict', finalMessage, timestamp],
  )
}

async function advanceGame(body: Body) {
  return withTx(async (client) => {
    const { room, players, self } = await requireContext(client, body, true)
    if (!isHost(room, self, body)) fail('Только создатель комнаты управляет этапами.', 403)
    const timestamp = now()
    if (room.phase === 'reveal') {
      if (players.some((player) => !player.revealed)) fail('Не все игроки подтвердили роль.', 409)
      await client.query(
        'UPDATE mafia_rooms SET phase = $1, phase_ends_at = $2, public_message = $3, updated_at = $4 WHERE id = $5',
        ['night', timestamp + 90000, 'Город уснул. Активные роли делают выбор на своих телефонах.', timestamp, room.id],
      )
    } else if (room.phase === 'night') {
      const actions = await turnActions(client, room)
      const missing = missingNightActors(players, new Set(actions.map((action) => action.player_id)))
      if (missing.length) {
        fail(`Ночь ещё не закончена. Ждём ход: ${missing.map((player) => player.name).join(', ')}.`, 409)
      }
      await resolveNight(client, room, players)
    } else if (room.phase === 'discussion') {
      const silent = players.filter((player) => player.alive && !player.revealed)
      if (silent.length) {
        fail(`Обсуждение ещё не закончено. Ждём: ${silent.map((player) => player.name).join(', ')}.`, 409)
      }
      await client.query(
        'UPDATE mafia_rooms SET phase = $1, phase_ends_at = $2, public_message = $3, updated_at = $4 WHERE id = $5',
        ['vote', timestamp + 90000, 'Выберите того, кто должен покинуть город.', timestamp, room.id],
      )
    } else if (room.phase === 'vote') {
      const actions = (await turnActions(client, room)).filter((action) => action.action_kind === 'lynch')
      const voted = new Set(actions.map((action) => action.player_id))
      const missingVotes = players.filter((player) => player.alive && !voted.has(player.id))
      if (missingVotes.length) {
        fail(`Голосование ещё не закончено. Ждём: ${missingVotes.map((player) => player.name).join(', ')}.`, 409)
      }
      await resolveVote(client, room, players)
    }
    else fail('Сейчас переход к следующему этапу недоступен.', 409)
    return { status: 200, body: { ok: true } }
  })
}

async function restartGame(body: Body) {
  return withTx(async (client) => {
    const { room, self } = await requireContext(client, body, true)
    if (!isHost(room, self, body)) fail('Только создатель комнаты может начать заново.', 403)
    if (room.phase !== 'finished') fail('Сначала завершите текущую партию.', 409)
    const timestamp = now()
    await client.query(
      'UPDATE mafia_players SET alive = true, role = NULL, team = NULL, revealed = false, private_note = $1 WHERE room_id = $2',
      ['', room.id],
    )
    await client.query('DELETE FROM mafia_actions WHERE room_id = $1', [room.id])
    await client.query('DELETE FROM mafia_events WHERE room_id = $1', [room.id])
    await client.query(
      `UPDATE mafia_rooms
       SET phase = 'lobby', round = 0, phase_ends_at = NULL, event_key = 'rain', public_message = $1, winner = NULL, updated_at = $2
       WHERE id = $3`,
      ['Город готов к новой истории.', timestamp, room.id],
    )
    return { status: 200, body: { ok: true } }
  })
}

const router = Router()

router.get('/ready', async (_req, res) => {
  try {
    await pool.query('SELECT 1 FROM mafia_rooms LIMIT 0')
    await pool.query('SELECT 1 FROM mafia_players LIMIT 0')
    send(res, { ok: true })
  } catch (error) {
    console.error('[mafia-shadows] ready', error)
    send(res, { ok: false }, 503)
  }
})

router.get('/', async (req, res) => {
  try {
    const code = codeOf(String(req.query.code ?? ''))
    const token = String(req.query.token ?? '')
    if (code.length !== 6 || !token) fail('Не хватает данных комнаты.')
    const result = await gameState(code, token, typeof req.query.hostToken === 'string' ? req.query.hostToken : null)
    send(res, result.body, result.status)
  } catch (error) {
    if (error instanceof ApiError) return send(res, { error: error.message }, error.status)
    console.error('[mafia-shadows] GET', error)
    send(res, { error: 'Город на секунду потерял связь. Повторите действие.' }, 500)
  }
})

router.post('/', async (req, res) => {
  try {
    const body = (req.body ?? {}) as Body
    let result: { status: number; body: unknown }
    if (body.action === 'create') result = await createRoom(req, body.name)
    else if (body.action === 'join') result = await joinRoom(body.code, body.name)
    else if (body.action === 'start') result = await startGame(body)
    else if (body.action === 'acknowledge') result = await acknowledgeRole(body)
    else if (body.action === 'turn') result = await submitTurnAction(body)
    else if (body.action === 'advance') result = await advanceGame(body)
    else if (body.action === 'restart') result = await restartGame(body)
    else fail('Неизвестное действие.')
    send(res, result.body, result.status)
  } catch (error) {
    if (error instanceof ApiError) return send(res, { error: error.message }, error.status)
    const pgCode = (error as { code?: string }).code
    if (pgCode === '23505') return send(res, { error: 'Комната обновилась. Повторите действие.' }, 409)
    console.error('[mafia-shadows] POST', error)
    send(res, { error: 'Город на секунду потерял связь. Повторите действие.' }, 500)
  }
})

export default router
