import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  ConnectionState,
  GameMode,
  RoomPayload,
  RoomSession,
  RoomStatus,
  SharedGameState,
} from '../lib/multiplayer'
import { ROOM_SESSION_KEY } from '../lib/multiplayer'
import type { CaseId, DistrictId } from '../lib/game-cases'
import { getBaseUrl } from '../../../lib/api'
import { getInitData } from '../../../lib/telegram'

type ApiResponse = {
  room?: RoomPayload
  session?: RoomSession
  error?: string
}

const API_PREFIX = '/api/sled/rooms'
const ROOM_TIMEOUT_MS = 12000

async function sledRequest(path: string, init: RequestInit = {}) {
  const initData = getInitData()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(typeof init.headers === 'object' && !(init.headers instanceof Headers)
      ? (init.headers as Record<string, string>)
      : {}),
  }
  if (initData) headers['x-telegram-init-data'] = initData

  const url = `${getBaseUrl()}${path}`
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), ROOM_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      ...init,
      headers,
      credentials: 'omit',
      signal: controller.signal,
      cache: 'no-store',
    })
    const body = (await response.json().catch(() => ({}))) as ApiResponse
    if (!response.ok) throw new Error(body.error ?? 'Канал комнаты не отвечает.')
    return body
  } finally {
    clearTimeout(timeoutId)
  }
}

export function useRoom() {
  const [session, setSession] = useState<RoomSession | null>(null)
  const [room, setRoom] = useState<RoomPayload | null>(null)
  const [connection, setConnection] = useState<ConnectionState>('offline')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const pollingRef = useRef(false)

  const storeSession = useCallback((next: RoomSession | null) => {
    setSession(next)
    if (typeof window === 'undefined') return
    if (next) window.sessionStorage.setItem(ROOM_SESSION_KEY, JSON.stringify(next))
    else window.sessionStorage.removeItem(ROOM_SESSION_KEY)
  }, [])

  const fetchRoom = useCallback(async (activeSession: RoomSession, quiet = false) => {
    if (pollingRef.current) return null
    pollingRef.current = true
    if (!quiet) setConnection('connecting')
    try {
      const body = await sledRequest(`${API_PREFIX}/${activeSession.code}`, {
        headers: { 'x-sled-player-token': activeSession.token },
      })
      if (body.room) setRoom(body.room)
      setConnection('synced')
      setError(null)
      return body.room ?? null
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'Комната недоступна.'
      setConnection('error')
      setError(message)
      return null
    } finally {
      pollingRef.current = false
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const raw = window.sessionStorage.getItem(ROOM_SESSION_KEY)
    if (!raw) return
    try {
      const restored = JSON.parse(raw) as RoomSession
      if (restored.code && restored.token && restored.participantId) {
        const timer = window.setTimeout(() => {
          setSession(restored)
          void fetchRoom(restored)
        }, 0)
        return () => window.clearTimeout(timer)
      }
    } catch {
      window.sessionStorage.removeItem(ROOM_SESSION_KEY)
    }
  }, [fetchRoom])

  useEffect(() => {
    if (!session) return
    const timer = window.setInterval(() => void fetchRoom(session, true), 1800)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void fetchRoom(session, true)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [fetchRoom, session])

  useEffect(() => {
    if (!session) return
    const ping = window.setInterval(() => {
      void sledRequest(`${API_PREFIX}/${session.code}/actions`, {
        method: 'POST',
        headers: { 'x-sled-player-token': session.token },
        body: JSON.stringify({ action: 'ping' }),
      }).catch(() => undefined)
    }, 12000)
    return () => window.clearInterval(ping)
  }, [session])

  const createRoom = useCallback(
    async (input: { name: string; caseId: CaseId; mode: GameMode; state: SharedGameState }) => {
      setBusy(true)
      setConnection('connecting')
      setError(null)
      try {
        const body = await sledRequest(API_PREFIX, {
          method: 'POST',
          body: JSON.stringify(input),
        })
        if (!body.session || !body.room) throw new Error('Комната создана без ключа доступа.')
        storeSession(body.session)
        setRoom(body.room)
        setConnection('synced')
        return body.room
      } catch (requestError) {
        const message = requestError instanceof Error ? requestError.message : 'Не удалось создать комнату.'
        setError(message)
        setConnection('error')
        throw requestError
      } finally {
        setBusy(false)
      }
    },
    [storeSession],
  )

  const joinRoom = useCallback(
    async (code: string, name: string) => {
      setBusy(true)
      setConnection('connecting')
      setError(null)
      const cleanCode = code.replace(/\D/g, '')
      try {
        const body = await sledRequest(`${API_PREFIX}/${cleanCode}/join`, {
          method: 'POST',
          body: JSON.stringify({ name }),
        })
        if (!body.session || !body.room) throw new Error('Вход выполнен без ключа игрока.')
        storeSession(body.session)
        setRoom(body.room)
        setConnection('synced')
        return body.room
      } catch (requestError) {
        const message = requestError instanceof Error ? requestError.message : 'Не удалось войти в комнату.'
        setError(message)
        setConnection('error')
        throw requestError
      } finally {
        setBusy(false)
      }
    },
    [storeSession],
  )

  const updateRoom = useCallback(
    async (status: RoomStatus, state: SharedGameState) => {
      if (!session?.isHost) return null
      setConnection('syncing')
      try {
        const body = await sledRequest(`${API_PREFIX}/${session.code}`, {
          method: 'PATCH',
          headers: { 'x-sled-player-token': session.token },
          body: JSON.stringify({ status, state }),
        })
        if (body.room) setRoom(body.room)
        setConnection('synced')
        setError(null)
        return body.room ?? null
      } catch (requestError) {
        const message =
          requestError instanceof Error ? requestError.message : 'Не удалось синхронизировать сцену.'
        setError(message)
        setConnection('error')
        return null
      }
    },
    [session],
  )

  const action = useCallback(
    async (payload: Record<string, unknown>) => {
      if (!session) return null
      setConnection('syncing')
      try {
        const body = await sledRequest(`${API_PREFIX}/${session.code}/actions`, {
          method: 'POST',
          headers: { 'x-sled-player-token': session.token },
          body: JSON.stringify(payload),
        })
        if (body.room) setRoom(body.room)
        setConnection('synced')
        setError(null)
        return body.room ?? null
      } catch (requestError) {
        const message = requestError instanceof Error ? requestError.message : 'Действие не отправлено.'
        setError(message)
        setConnection('error')
        throw requestError
      }
    },
    [session],
  )

  const setReady = useCallback((ready: boolean) => action({ action: 'ready', ready }), [action])
  const vote = useCallback(
    (roundIndex: number, district: DistrictId) => action({ action: 'vote', roundIndex, district }),
    [action],
  )
  const triggerAbility = useCallback(() => action({ action: 'ability' }), [action])

  const leaveRoom = useCallback(() => {
    storeSession(null)
    setRoom(null)
    setConnection('offline')
    setError(null)
  }, [storeSession])

  return {
    session,
    room,
    connection,
    error,
    busy,
    createRoom,
    joinRoom,
    updateRoom,
    setReady,
    vote,
    triggerAbility,
    leaveRoom,
    refreshRoom: () => (session ? fetchRoom(session) : Promise.resolve(null)),
  }
}
