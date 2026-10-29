import { Router, type Request, type Response } from 'express'
import { query } from '../db.js'
import { getUserPremiumWithDb } from '../premiumStore.js'
import { verifyInitData } from '../telegram/verifyInitData.js'
import { roleById } from '../sled/types.js'
import { sledStartRefusal } from '../party/partyRules.js'
import {
  RoomApiError,
  authenticate,
  claimAbility,
  cleanCode,
  cleanName,
  clearExpiredRooms,
  createRoomWithHost,
  getPlayerToken,
  joinRoom,
  patchRoom,
  serializeRoom,
  setReady,
  setVote,
  touchParticipant,
  validCaseId,
  validMode,
  validateSharedState,
} from '../sled/room-server.js'

const router = Router()

function sendError(res: Response, error: unknown) {
  if (error instanceof RoomApiError) {
    res.status(error.status).json({ error: error.message })
    return
  }
  console.error('[sled] room API error', error)
  res.status(500).json({ error: 'Канал комнаты временно недоступен. Попробуйте ещё раз.' })
}

/** Deploy gate: tables reachable by the backend DB role (no client RLS bypass). */
router.get('/ready', async (_req, res) => {
  try {
    await query('SELECT 1 FROM sled_rooms LIMIT 0')
    await query('SELECT 1 FROM sled_participants LIMIT 0')
    await query('SELECT 1 FROM sled_room_events LIMIT 0')
    res.status(200).json({ ok: true, sled: true })
  } catch (error) {
    console.error('[sled] ready check failed', error)
    res.status(503).json({ ok: false, sled: false, error: 'sled schema unavailable' })
  }
})

async function callerIsPremium(req: Request): Promise<boolean> {
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

/** Optional Telegram identity — never trusted from the request body. Guests allowed. */
function optionalTelegramId(req: Request): number | null {
  const raw = req.headers['x-telegram-init-data']
  const initData = typeof raw === 'string' ? raw.trim() : ''
  if (!initData) return null
  const botToken = process.env.TELEGRAM_BOT_TOKEN ?? process.env.BOT_TOKEN ?? ''
  if (!botToken) return null
  try {
    return verifyInitData(initData, botToken).telegram_id
  } catch {
    return null
  }
}

router.post('/rooms', async (req, res) => {
  try {
    if (!(await callerIsPremium(req))) {
      res.status(403).json({ error: 'Создать комнату можно только с Premium.' })
      return
    }
    optionalTelegramId(req)
    const name = cleanName(req.body?.name)
    if (!validCaseId(req.body?.caseId)) {
      res.status(400).json({ error: 'Выберите доступное дело.' })
      return
    }
    if (!validMode(req.body?.mode)) {
      res.status(400).json({ error: 'Выберите режим игры.' })
      return
    }
    const initialState = validateSharedState(req.body?.state)
    await clearExpiredRooms()
    const session = await createRoomWithHost({
      name,
      caseId: req.body.caseId,
      mode: req.body.mode,
      state: initialState,
    })
    const room = await serializeRoom(session.code, session.participantId)
    res.status(201).json({ room, session })
  } catch (error) {
    sendError(res, error)
  }
})

router.post('/rooms/:code/join', async (req, res) => {
  try {
    optionalTelegramId(req)
    const code = cleanCode(req.params.code)
    const name = cleanName(req.body?.name)
    const session = await joinRoom(code, name)
    const room = await serializeRoom(session.code, session.participantId)
    res.status(201).json({ room, session })
  } catch (error) {
    sendError(res, error)
  }
})

router.get('/rooms/:code', async (req, res) => {
  try {
    const token = getPlayerToken(req.headers['x-sled-player-token'])
    const { participant } = await authenticate(req.params.code, token)
    await touchParticipant(participant.id)
    res.json({ room: await serializeRoom(participant.room_code, participant.id) })
  } catch (error) {
    sendError(res, error)
  }
})

router.patch('/rooms/:code', async (req, res) => {
  try {
    const token = getPlayerToken(req.headers['x-sled-player-token'])
    const { room, participant } = await authenticate(req.params.code, token)
    if (!participant.is_host || room.host_participant_id !== participant.id) {
      res.status(403).json({ error: 'Только ведущий управляет сценой.' })
      return
    }
    const allowedStatuses = ['lobby', 'roles', 'game', 'final', 'ended']
    const nextStatus =
      typeof req.body?.status === 'string' && allowedStatuses.includes(req.body.status)
        ? req.body.status
        : room.status
    const nextState =
      req.body?.state === undefined
        ? validateSharedState(
            typeof room.state === 'object' ? room.state : JSON.parse(String(room.state || '{}')),
          )
        : validateSharedState(req.body.state)
    if (room.status === 'lobby' && (nextStatus === 'roles' || nextStatus === 'game')) {
      const counted = await query<{ n: string | number }>(
        'SELECT count(*)::int AS n FROM sled_participants WHERE room_code = $1',
        [room.code],
      )
      const refusal = sledStartRefusal(Number(counted.rows[0]?.n ?? 0))
      if (refusal) {
        res.status(409).json({ error: refusal })
        return
      }
    }
    await patchRoom(room.code, participant.id, nextStatus, nextState)
    await touchParticipant(participant.id)
    res.json({ room: await serializeRoom(room.code, participant.id) })
  } catch (error) {
    sendError(res, error)
  }
})

router.post('/rooms/:code/actions', async (req, res) => {
  try {
    const token = getPlayerToken(req.headers['x-sled-player-token'])
    const { room, participant } = await authenticate(req.params.code, token)
    const body = req.body ?? {}
    const sharedState =
      typeof room.state === 'object' && room.state
        ? room.state
        : (() => {
            try {
              return JSON.parse(String(room.state || '{}')) as {
                signalOpen?: boolean
                resolved?: boolean
                roundIndex?: number
                timerDeadline?: number | null
                analystRounds?: number[]
              }
            } catch {
              return {}
            }
          })()

    if (body.action === 'ready') {
      if (room.status !== 'lobby' && room.status !== 'roles') {
        throw new RoomApiError(409, 'Подготовка уже завершена.')
      }
      await setReady(participant.id, body.ready === true)
    } else if (body.action === 'vote') {
      if (room.status !== 'game') throw new RoomApiError(409, 'Голосование пока закрыто.')
      const roundIndex = Number(body.roundIndex)
      const district = typeof body.district === 'string' ? body.district.trim() : ''
      if (!Number.isInteger(roundIndex) || district.length < 2 || district.length > 48) {
        throw new RoomApiError(400, 'Некорректная версия района.')
      }
      if (!sharedState.signalOpen || sharedState.resolved || sharedState.roundIndex !== roundIndex) {
        throw new RoomApiError(409, 'Голосование по этой сцене уже закрыто.')
      }
      await setVote(participant.id, roundIndex, district)
    } else if (body.action === 'ability') {
      if (room.status !== 'game') {
        throw new RoomApiError(409, 'Способность доступна только во время расследования.')
      }
      if (participant.ability_used) throw new RoomApiError(409, 'Способность уже использована.')
      if (!sharedState.signalOpen || sharedState.resolved) {
        throw new RoomApiError(409, 'Дождитесь активного сигнала. Способность не потрачена.')
      }
      const role = roleById(participant.role_id)
      const roundIndex = sharedState.roundIndex ?? 0
      const analystRounds = Array.isArray(sharedState.analystRounds) ? sharedState.analystRounds : []
      if (role.effect === 'reveal_detail' && analystRounds.includes(roundIndex)) {
        throw new RoomApiError(409, 'Связка этого раунда уже открыта. Способность не потрачена.')
      }
      if (role.effect === 'extra_time' && typeof sharedState.timerDeadline !== 'number') {
        throw new RoomApiError(409, 'Таймер сейчас не идёт. Способность не потрачена.')
      }
      await claimAbility(room.code, participant, roundIndex)
    } else if (body.action === 'ping') {
      await touchParticipant(participant.id)
    } else {
      throw new RoomApiError(400, 'Неизвестное действие комнаты.')
    }

    res.json({ room: await serializeRoom(room.code, participant.id) })
  } catch (error) {
    sendError(res, error)
  }
})

export default router
