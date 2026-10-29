import { Router, type Request, type Response } from 'express'
import type { PoolClient } from 'pg'
import { pool } from '../db.js'
import { verifyInitData } from '../telegram/verifyInitData.js'
import { getUserPremiumWithDb } from '../premiumStore.js'
import {
  CASES,
  MAX_PLAYERS,
  MIN_PLAYERS,
  MISSIONS,
  SUPPORT_IDENTITIES,
  caseByKey,
  connectionFor,
  type Archetype,
  type Phase,
} from '../doubles/doubles.js'
import { erasedGuessOptions, splitSupportCast } from '../party/partyRules.js'

type RoomRow = {
  id: string
  code: string
  host_token: string
  phase: Phase
  case_key: string
  phase_ends_at: string | number | null
  public_message: string
  result_player_id: string | null
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
  archetype: Archetype | null
  identity_key: string | null
  identity_title: string | null
  identity_subtitle: string | null
  dossier_json: unknown
  secret_task: string
  interrogation_prompt: string
  is_original: boolean
  hidden_identity: string | null
  echoes_json: unknown
  revealed: boolean
  vote_target_id: string | null
  identity_guess: string | null
  joined_at: string | number
}
type Body = {
  action?: string
  code?: string
  name?: string
  token?: string
  hostToken?: string
  targetId?: string
  identityGuess?: string
}

class ApiError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

function send(res: Response, data: unknown, status = 200) {
  res.setHeader('Cache-Control', 'no-store')
  res.status(status).json(data)
}
function fail(message: string, status = 400): never {
  throw new ApiError(message, status)
}
function codeOf(value?: string | null) {
  return (value ?? '').replace(/\D/g, '').slice(0, 6)
}
function nameOf(value?: string | null) {
  return (value ?? '').trim().replace(/\s+/g, ' ').slice(0, 18)
}
function normalize(value?: string | null) {
  return (value ?? '').trim().toLocaleLowerCase('ru')
}
function now() {
  return Date.now()
}
function num(value: string | number | null) {
  if (value == null) return null
  return typeof value === 'number' ? value : Number(value)
}
function randomIndex(max: number) {
  return crypto.getRandomValues(new Uint32Array(1))[0] % max
}
function shuffle<T>(items: T[]) {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = randomIndex(index + 1)
    ;[result[index], result[target]] = [result[target], result[index]]
  }
  return result
}
function parseList(value: unknown) {
  if (Array.isArray(value)) return value.map(String)
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown
      return Array.isArray(parsed) ? parsed.map(String) : []
    } catch {
      return []
    }
  }
  return []
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
async function findRoom(client: PoolClient, code: string) {
  const found = await client.query<RoomRow>('SELECT * FROM doubles_rooms WHERE code = $1 LIMIT 1', [code])
  return found.rows[0] ?? null
}
async function lockRoom(client: PoolClient, code: string) {
  const found = await client.query<RoomRow>('SELECT * FROM doubles_rooms WHERE code = $1 FOR UPDATE', [code])
  return found.rows[0] ?? null
}
async function roomPlayers(client: PoolClient, roomId: string) {
  const found = await client.query<PlayerRow>(
    'SELECT * FROM doubles_players WHERE room_id = $1 ORDER BY joined_at ASC',
    [roomId],
  )
  return found.rows
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
    const chosenCase = CASES[randomIndex(CASES.length)]
    await client.query(
      `INSERT INTO doubles_rooms (id, code, host_token, phase, case_key, public_message, created_at, updated_at)
       VALUES ($1, $2, $3, 'lobby', $4, $5, $6, $7)`,
      [roomId, code, hostToken, chosenCase.key, 'Соберите от 4 до 12 игроков.', timestamp, timestamp],
    )
    await client.query(
      `INSERT INTO doubles_players (id, room_id, token, name, avatar, is_host, joined_at)
       VALUES ($1, $2, $3, $4, $5, true, $6)`,
      [playerId, roomId, token, name, randomIndex(10), timestamp],
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
    if (room.phase !== 'lobby') fail('Расследование уже началось. Дождитесь следующей партии.', 409)
    const players = await roomPlayers(client, room.id)
    if (players.length >= MAX_PLAYERS) fail('В комнате уже 12 игроков.', 409)
    if (players.some((player) => normalize(player.name) === normalize(name))) fail('Такое имя уже занято в этой комнате.', 409)
    const id = crypto.randomUUID()
    const token = crypto.randomUUID()
    await client.query(
      `INSERT INTO doubles_players (id, room_id, token, name, avatar, is_host, joined_at)
       VALUES ($1, $2, $3, $4, $5, false, $6)`,
      [id, room.id, token, name, randomIndex(10), now()],
    )
    return { status: 201, body: { code, token } }
  })
}

async function requireContext(client: PoolClient, body: Body, lock = false) {
  const room = lock ? await lockRoom(client, codeOf(body.code)) : await findRoom(client, codeOf(body.code))
  if (!room) fail('Комната не найдена.', 404)
  const players = await roomPlayers(client, room.id)
  const self = players.find((player) => player.token === (body.token ?? ''))
  if (!self) fail('Это устройство не подключено к комнате.', 401)
  return { room, players, self }
}
function isHost(room: RoomRow, self: PlayerRow, body: Body) {
  return Boolean(self.is_host && body.hostToken && body.hostToken === room.host_token)
}
function echoLimit(phase: Phase) {
  if (phase === 'interrogation') return 2
  if (phase === 'evidence' || phase === 'vote' || phase === 'finished') return 3
  return 1
}
function publicIdentity(player: PlayerRow, phase: Phase) {
  if (phase === 'lobby' || phase === 'reveal' || phase === 'testimony') return null
  if (player.archetype === 'erased') return 'Личность не установлена'
  return player.identity_title
}
function identityOptions(players: PlayerRow[]) {
  return [...new Set(players.map((player) => player.identity_title).filter((value): value is string => Boolean(value)))]
}
function guessOptionsFor(players: PlayerRow[]) {
  const erased = players.find((player) => player.archetype === 'erased')
  const witnessTitles = players
    .filter((player) => player.archetype === 'witness' && player.identity_title)
    .map((player) => player.identity_title as string)
  const used = new Set(players.map((player) => player.identity_title).filter((value): value is string => Boolean(value)))
  const hidden = erased?.hidden_identity ?? ''
  const unused = SUPPORT_IDENTITIES.map((identity) => identity.title).filter((title) => title !== hidden && !used.has(title))
  return erasedGuessOptions({ witnessTitles, hiddenTitle: hidden, unusedTitles: unused })
}
function resultFor(room: RoomRow, players: PlayerRow[], self: PlayerRow) {
  if (room.phase !== 'finished') return null
  const claimants = players.filter((player) => player.archetype === 'claimant')
  const original = claimants.find((player) => player.is_original) ?? claimants[0]
  const duplicate = claimants.find((player) => !player.is_original) ?? claimants[1]
  const selected = players.find((player) => player.id === room.result_player_id) ?? null
  const erased = players.find((player) => player.archetype === 'erased') ?? null
  const voteCounts = Object.fromEntries(claimants.map((candidate) => [candidate.id, players.filter((player) => player.vote_target_id === candidate.id).length]))
  const erasedCorrect = Boolean(erased?.identity_guess && normalize(erased.identity_guess) === normalize(erased.hidden_identity))
  const outcome = !selected ? 'tie' : selected.is_original ? 'original' : 'duplicate'
  let score = 0
  if (self.archetype === 'claimant' && selected?.id === self.id) score = 2
  if (self.archetype === 'witness' && self.vote_target_id === original?.id) score = 1
  if (self.archetype === 'erased') {
    if (self.vote_target_id === original?.id) score += 1
    if (normalize(self.identity_guess) === normalize(self.hidden_identity)) score += 2
  }
  return {
    outcome,
    selectedId: selected?.id ?? null,
    originalId: original?.id ?? null,
    duplicateId: duplicate?.id ?? null,
    voteCounts,
    erased: erased ? {
      playerId: erased.id,
      hiddenIdentity: erased.hidden_identity,
      guess: erased.identity_guess,
      correct: erasedCorrect,
    } : null,
    personal: {
      score,
      title: score >= 2 ? 'Личность удержана' : score === 1 ? 'След найден' : 'Архив вас запутал',
      text: self.archetype === 'erased'
        ? (normalize(self.identity_guess) === normalize(self.hidden_identity) ? 'Вы собрали себя по обрывкам чужих разговоров.' : `Вашей личностью была: ${self.hidden_identity}.`)
        : self.archetype === 'claimant'
          ? (selected?.id === self.id ? 'Комната поверила вашей версии истории.' : 'Другой претендент оказался убедительнее.')
          : (self.vote_target_id === original?.id ? 'Вы проголосовали за настоящего владельца личности.' : 'Двойник заставил вас поверить в чужую память.'),
    },
  }
}

async function gameState(code: string, token: string, hostToken?: string | null) {
  return withClient(async (client) => {
    const room = await findRoom(client, code)
    if (!room) fail('Комната не найдена.', 404)
    const players = await roomPlayers(client, room.id)
    const self = players.find((player) => player.token === token)
    if (!self) fail('Это устройство не подключено к комнате.', 401)
    const identityCase = caseByKey(room.case_key)
    const claimants = players.filter((player) => player.archetype === 'claimant')
    const revealCompleted = players.filter((player) => player.revealed).length
    const voteCompleted = players.filter((player) => player.vote_target_id && (player.archetype !== 'erased' || player.identity_guess)).length
    const required = room.phase === 'reveal' || room.phase === 'vote' ? players.length : 0
    const completed = room.phase === 'reveal' ? revealCompleted : room.phase === 'vote' ? voteCompleted : 0
    const host = Boolean(hostToken && hostToken === room.host_token && self.is_host)
    const evidenceOpen = room.phase === 'evidence' || room.phase === 'vote' || room.phase === 'finished'
    return {
      status: 200,
      body: {
        room: {
          code: room.code,
          phase: room.phase,
          phaseEndsAt: num(room.phase_ends_at),
          publicMessage: room.public_message,
          resultPlayerId: room.result_player_id,
          case: {
            number: identityCase.number,
            name: identityCase.name,
            targetTitle: identityCase.targetTitle,
            targetSubtitle: identityCase.targetSubtitle,
            intro: identityCase.intro,
            evidenceTitle: evidenceOpen ? identityCase.evidenceTitle : null,
            evidenceText: evidenceOpen ? identityCase.evidenceText : null,
            evidencePrompt: evidenceOpen ? identityCase.evidencePrompt : null,
          },
        },
        self: {
          id: self.id,
          name: self.name,
          avatar: self.avatar,
          archetype: self.archetype,
          identityTitle: self.archetype === 'erased' && room.phase !== 'finished' ? null : self.identity_title,
          identitySubtitle: self.archetype === 'erased' && room.phase !== 'finished' ? null : self.identity_subtitle,
          dossier: parseList(self.dossier_json),
          secretTask: self.secret_task,
          interrogationPrompt: self.interrogation_prompt,
          echoes: parseList(self.echoes_json).slice(0, echoLimit(room.phase)),
          revealed: Boolean(self.revealed),
          hasVoted: Boolean(self.vote_target_id && (self.archetype !== 'erased' || self.identity_guess)),
          voteTargetId: self.vote_target_id,
          identityGuess: self.identity_guess,
          hiddenIdentity: room.phase === 'finished' ? self.hidden_identity : null,
          isOriginal: room.phase === 'finished' && self.archetype === 'claimant' ? Boolean(self.is_original) : null,
          isHost: host,
        },
        players: players.map((player) => ({
          id: player.id,
          name: player.name,
          avatar: player.avatar,
          isHost: Boolean(player.is_host),
          ready: room.phase === 'reveal' ? Boolean(player.revealed) : room.phase === 'vote' ? Boolean(player.vote_target_id && (player.archetype !== 'erased' || player.identity_guess)) : false,
          publicIdentity: publicIdentity(player, room.phase),
          archetype: room.phase === 'finished' ? player.archetype : null,
          isOriginal: room.phase === 'finished' && player.archetype === 'claimant' ? Boolean(player.is_original) : null,
          voteCount: room.phase === 'finished' ? players.filter((voter) => voter.vote_target_id === player.id).length : 0,
        })),
        claimants: claimants.map((player) => ({ id: player.id, name: player.name, avatar: player.avatar, identity: player.identity_title })),
        identityOptions: self.archetype === 'erased' ? guessOptionsFor(players) : identityOptions(players),
        progress: { completed, required },
        result: resultFor(room, players, self),
      },
    }
  })
}

async function startGame(body: Body) {
  return withTx(async (client) => {
    const { room, players, self } = await requireContext(client, body, true)
    if (!isHost(room, self, body)) fail('Только создатель комнаты может открыть досье.', 403)
    if (room.phase !== 'lobby') fail('Расследование уже началось.', 409)
    if (players.length < MIN_PLAYERS) fail(`Нужно ещё игроков: ${MIN_PLAYERS - players.length}.`)
    const identityCase = CASES[randomIndex(CASES.length)]
    const orderedPlayers = shuffle(players)
    const claimantPlayers = orderedPlayers.slice(0, 2)
    const erasedPlayer = orderedPlayers[2]
    const witnessPlayers = orderedPlayers.slice(3)
    const cast = splitSupportCast(shuffle(SUPPORT_IDENTITIES), witnessPlayers.length)
    const supportProfiles = cast.witnesses
    const hiddenProfile = cast.hidden
    const originalId = claimantPlayers[randomIndex(2)].id
    const timestamp = now()
    for (const [index, player] of claimantPlayers.entries()) {
      const original = player.id === originalId
      const fragments = original
        ? [identityCase.sharedMemories[0], identityCase.sharedMemories[1], identityCase.authenticMemory]
        : [identityCase.sharedMemories[2], identityCase.sharedMemories[3], identityCase.distortedMemory]
      await client.query(
        `UPDATE doubles_players
         SET archetype = 'claimant', identity_key = $1, identity_title = $2, identity_subtitle = $3,
             dossier_json = $4::jsonb, secret_task = $5, interrogation_prompt = $6, is_original = $7,
             hidden_identity = NULL, echoes_json = '[]'::jsonb, revealed = false, vote_target_id = NULL, identity_guess = NULL
         WHERE id = $8`,
        [identityCase.key, identityCase.targetTitle, identityCase.targetSubtitle, JSON.stringify(fragments), MISSIONS[(index + randomIndex(MISSIONS.length)) % MISSIONS.length], identityCase.crossQuestion, original, player.id],
      )
    }
    await client.query(
      `UPDATE doubles_players
       SET archetype = 'erased', identity_key = NULL, identity_title = NULL, identity_subtitle = NULL,
           dossier_json = '[]'::jsonb, secret_task = $1, interrogation_prompt = $2, is_original = false,
           hidden_identity = $3, echoes_json = $4::jsonb, revealed = false, vote_target_id = NULL, identity_guess = NULL
       WHERE id = $5`,
      ['Не говорите первую догадку сразу. Соберите все три эха и только потом назовите себя.', 'Спросите любого игрока: «Что во мне кажется вам знакомым?» — и слушайте не профессию, а детали.', hiddenProfile.title, JSON.stringify(hiddenProfile.echoes), erasedPlayer.id],
    )
    for (const [index, player] of witnessPlayers.entries()) {
      const profile = supportProfiles[index]
      const profileIndex = SUPPORT_IDENTITIES.findIndex((item) => item.key === profile.key)
      const dossier = [
        profile.personalMemory,
        connectionFor(profile, identityCase.targetTitle),
        identityCase.witnessObservations[profileIndex % identityCase.witnessObservations.length],
      ]
      await client.query(
        `UPDATE doubles_players
         SET archetype = 'witness', identity_key = $1, identity_title = $2, identity_subtitle = $3,
             dossier_json = $4::jsonb, secret_task = $5, interrogation_prompt = $6, is_original = false,
             hidden_identity = NULL, echoes_json = '[]'::jsonb, revealed = false, vote_target_id = NULL, identity_guess = NULL
         WHERE id = $7`,
        [profile.key, profile.title, profile.subtitle, JSON.stringify(dossier), MISSIONS[(index + 2 + randomIndex(MISSIONS.length)) % MISSIONS.length], profile.question, player.id],
      )
    }
    await client.query(
      `UPDATE doubles_rooms
       SET phase = 'reveal', case_key = $1, phase_ends_at = NULL, public_message = $2, result_player_id = NULL, updated_at = $3
       WHERE id = $4`,
      [identityCase.key, identityCase.intro, timestamp, room.id],
    )
    return { status: 200, body: { ok: true } }
  })
}

async function acknowledge(body: Body) {
  return withTx(async (client) => {
    const { room, self } = await requireContext(client, body, true)
    if (room.phase !== 'reveal') fail('Досье уже закрыты.', 409)
    await client.query('UPDATE doubles_players SET revealed = true WHERE id = $1', [self.id])
    return { status: 200, body: { ok: true } }
  })
}

async function submitVote(body: Body) {
  return withTx(async (client) => {
    const { room, players, self } = await requireContext(client, body, true)
    if (room.phase !== 'vote') fail('Сейчас голосование закрыто.', 409)
    const candidate = players.find((player) => player.id === body.targetId && player.archetype === 'claimant')
    if (!candidate) fail('Выберите одного из двух претендентов.')
    let guess: string | null = null
    if (self.archetype === 'erased') {
      const options = guessOptionsFor(players)
      const matched = options.find((option) => normalize(option) === normalize(body.identityGuess))
      if (!matched) fail('Сначала выберите, кем была ваша стёртая личность.')
      guess = matched
    }
    await client.query('UPDATE doubles_players SET vote_target_id = $1, identity_guess = $2 WHERE id = $3', [candidate.id, guess, self.id])
    return { status: 200, body: { ok: true } }
  })
}

async function finishVote(client: PoolClient, room: RoomRow, players: PlayerRow[]) {
  const claimants = players.filter((player) => player.archetype === 'claimant')
  const counts = new Map(claimants.map((candidate) => [candidate.id, players.filter((player) => player.vote_target_id === candidate.id).length]))
  const maximum = Math.max(...counts.values())
  const leaders = [...counts.entries()].filter(([, count]) => count === maximum).map(([id]) => id)
  const resultPlayerId = leaders.length === 1 ? leaders[0] : null
  const selected = players.find((player) => player.id === resultPlayerId)
  const publicMessage = !selected
    ? 'Голоса разделились. Архив не смог выбрать одну версию.'
    : selected.is_original
      ? `Комната поверила ${selected.name}. Настоящая личность вернулась владельцу.`
      : `Комната поверила ${selected.name}. Двойник убедил всех лучше оригинала.`
  await client.query(
    `UPDATE doubles_rooms SET phase = 'finished', phase_ends_at = NULL, result_player_id = $1, public_message = $2, updated_at = $3 WHERE id = $4`,
    [resultPlayerId, publicMessage, now(), room.id],
  )
}

async function advanceGame(body: Body) {
  return withTx(async (client) => {
    const { room, players, self } = await requireContext(client, body, true)
    if (!isHost(room, self, body)) fail('Только создатель комнаты управляет этапами.', 403)
    const timestamp = now()
    if (room.phase === 'reveal') {
      if (players.some((player) => !player.revealed)) fail('Не все игроки запомнили свои досье.', 409)
      await client.query(
        `UPDATE doubles_rooms SET phase = 'testimony', phase_ends_at = $1, public_message = $2, updated_at = $3 WHERE id = $4`,
        [timestamp + 180000, 'Представьтесь и назовите две детали из своей памяти.', timestamp, room.id],
      )
    } else if (room.phase === 'testimony') {
      await client.query(
        `UPDATE doubles_rooms SET phase = 'interrogation', phase_ends_at = $1, public_message = $2, updated_at = $3 WHERE id = $4`,
        [timestamp + 240000, 'Задавайте точные вопросы. Общие ответы ничего не доказывают.', timestamp, room.id],
      )
    } else if (room.phase === 'interrogation') {
      await client.query(
        `UPDATE doubles_rooms SET phase = 'evidence', phase_ends_at = $1, public_message = $2, updated_at = $3 WHERE id = $4`,
        [timestamp + 150000, 'Архив нашёл одну улику. Сравните её с первыми версиями.', timestamp, room.id],
      )
    } else if (room.phase === 'evidence') {
      await client.query(
        `UPDATE doubles_rooms SET phase = 'vote', phase_ends_at = $1, public_message = $2, updated_at = $3 WHERE id = $4`,
        [timestamp + 180000, 'Выберите настоящего владельца личности. Голос останется тайным.', timestamp, room.id],
      )
    } else if (room.phase === 'vote') {
      const completed = players.filter((player) => player.vote_target_id && (player.archetype !== 'erased' || player.identity_guess)).length
      if (completed < players.length) fail('Не все игроки завершили голосование.', 409)
      await finishVote(client, room, players)
    } else {
      fail('Сейчас перейти дальше нельзя.', 409)
    }
    return { status: 200, body: { ok: true } }
  })
}

async function restartGame(body: Body) {
  return withTx(async (client) => {
    const { room, self } = await requireContext(client, body, true)
    if (!isHost(room, self, body)) fail('Только создатель комнаты может открыть новое дело.', 403)
    if (room.phase !== 'finished') fail('Сначала завершите текущее дело.', 409)
    const timestamp = now()
    await client.query(
      `UPDATE doubles_players
       SET archetype = NULL, identity_key = NULL, identity_title = NULL, identity_subtitle = NULL,
           dossier_json = '[]'::jsonb, secret_task = '', interrogation_prompt = '', is_original = false,
           hidden_identity = NULL, echoes_json = '[]'::jsonb, revealed = false, vote_target_id = NULL, identity_guess = NULL
       WHERE room_id = $1`,
      [room.id],
    )
    await client.query(
      `UPDATE doubles_rooms SET phase = 'lobby', phase_ends_at = NULL, public_message = $1, result_player_id = NULL, updated_at = $2 WHERE id = $3`,
      ['Архив готов открыть новое дело.', timestamp, room.id],
    )
    return { status: 200, body: { ok: true } }
  })
}

const router = Router()

router.get('/ready', async (_req, res) => {
  try {
    await pool.query('SELECT 1 FROM doubles_rooms LIMIT 0')
    await pool.query('SELECT 1 FROM doubles_players LIMIT 0')
    send(res, { ok: true })
  } catch (error) {
    console.error('[doubles] ready', error)
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
    console.error('[doubles] GET', error)
    send(res, { error: 'Архив на секунду потерял связь. Повторите действие.' }, 500)
  }
})

router.post('/', async (req, res) => {
  try {
    const body = (req.body ?? {}) as Body
    let result: { status: number; body: unknown }
    if (body.action === 'create') result = await createRoom(req, body.name)
    else if (body.action === 'join') result = await joinRoom(body.code, body.name)
    else if (body.action === 'start') result = await startGame(body)
    else if (body.action === 'acknowledge') result = await acknowledge(body)
    else if (body.action === 'vote') result = await submitVote(body)
    else if (body.action === 'advance') result = await advanceGame(body)
    else if (body.action === 'restart') result = await restartGame(body)
    else fail('Неизвестное действие.')
    send(res, result.body, result.status)
  } catch (error) {
    if (error instanceof ApiError) return send(res, { error: error.message }, error.status)
    const pgCode = (error as { code?: string }).code
    if (pgCode === '23505') return send(res, { error: 'Комната обновилась. Повторите действие.' }, 409)
    console.error('[doubles] POST', error)
    send(res, { error: 'Архив на секунду потерял связь. Повторите действие.' }, 500)
  }
})

export default router
