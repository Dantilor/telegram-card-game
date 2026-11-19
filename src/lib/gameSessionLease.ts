import { apiPost } from './api'

const CLIENT_KEY = 'gnh_game_lease_client'
const HEARTBEAT_MS = 25_000

export type GameSessionAcquireResult =
  | { ok: true; enabled: boolean; activeCount?: number }
  | { ok: false; limitReached: true; activeCount?: number }

type AcquireResponse = {
  ok: boolean
  enabled?: boolean
  leaseId?: string
  expiresAt?: string
  activeCount?: number
  limit?: number
  code?: string
}

let enabledCache: boolean | null = null
let heldGameId: string | null = null
let heartbeatTimer: ReturnType<typeof setInterval> | null = null
let pageHideBound = false

function randomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `lease_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`
}

export function getClientLeaseId(): string {
  if (typeof sessionStorage === 'undefined') return randomId()
  try {
    const existing = sessionStorage.getItem(CLIENT_KEY)
    if (existing && existing.length >= 8) return existing
    const next = randomId()
    sessionStorage.setItem(CLIENT_KEY, next)
    return next
  } catch {
    return randomId()
  }
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
}

function startHeartbeat() {
  stopHeartbeat()
  heartbeatTimer = setInterval(() => {
    void heartbeatGameSessionLease()
  }, HEARTBEAT_MS)
  if (!pageHideBound && typeof window !== 'undefined') {
    pageHideBound = true
    window.addEventListener('pagehide', () => {
      void releaseGameSessionLease({ keepalive: true })
    })
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && heldGameId) {
        void heartbeatGameSessionLease()
      }
    })
  }
}

/** Acquire or refresh a game-session lease. No-op when feature flag is off. */
export async function acquireGameSessionLease(gameId: string): Promise<GameSessionAcquireResult> {
  if (enabledCache === false) return { ok: true, enabled: false }
  try {
    const body = await apiPost<AcquireResponse>('/api/game-sessions/acquire', {
      clientLeaseId: getClientLeaseId(),
      gameId,
    })
    enabledCache = body.enabled !== false
    if (body.enabled === false) return { ok: true, enabled: false }
    heldGameId = gameId
    startHeartbeat()
    return { ok: true, enabled: true, activeCount: body.activeCount }
  } catch (e) {
    const err = e as Error & { status?: number; code?: string; body?: { code?: string; activeCount?: number } }
    if (err.status === 409 || err.code === 'game_session_limit_reached') {
      return {
        ok: false,
        limitReached: true,
        activeCount: err.body?.activeCount,
      }
    }
    // Fail open on unexpected outages so games still start; server remains source of truth when healthy.
    if (err.status === 404 || err.status === 503) {
      enabledCache = false
      return { ok: true, enabled: false }
    }
    console.warn('[game-session] acquire failed', err.status || err.message)
    return { ok: true, enabled: enabledCache !== false }
  }
}

export async function heartbeatGameSessionLease(): Promise<void> {
  if (enabledCache === false || !heldGameId) return
  try {
    await apiPost('/api/game-sessions/heartbeat', {
      clientLeaseId: getClientLeaseId(),
    })
  } catch {
    /* transient */
  }
}

export async function releaseGameSessionLease(opts?: { keepalive?: boolean }): Promise<void> {
  const had = Boolean(heldGameId)
  heldGameId = null
  stopHeartbeat()
  if (enabledCache === false || !had) return
  try {
    if (opts?.keepalive && typeof fetch === 'function') {
      const { resolveApiBase } = await import('./apiBase')
      const { csrfHeadersForMutation } = await import('./csrf')
      const { getInitData } = await import('./telegram')
      const { isWebShell } = await import('../config/shell')
      const base = resolveApiBase(import.meta.env)
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...csrfHeadersForMutation('POST'),
      }
      if (!isWebShell()) {
        const initData = getInitData()
        if (initData) headers['x-telegram-init-data'] = initData
      }
      void fetch(`${base}/api/game-sessions/release`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ clientLeaseId: getClientLeaseId() }),
        credentials: isWebShell() ? 'include' : 'omit',
        keepalive: true,
      })
      return
    }
    await apiPost('/api/game-sessions/release', {
      clientLeaseId: getClientLeaseId(),
    })
  } catch {
    /* TTL will free the slot */
  }
}

export function isGameSessionHeld(): boolean {
  return Boolean(heldGameId)
}

export const GAME_SESSION_LIMIT_EVENT = 'gnh-game-session-limit'

export function notifyGameSessionLimitReached(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(GAME_SESSION_LIMIT_EVENT))
}

/** Paths where a held lease should be released (catalog / account — not active play). */
export function shouldReleaseLeaseOnPath(pathname: string): boolean {
  const exact = new Set([
    '/',
    '/login',
    '/games',
    '/comics',
    '/card',
    '/decks',
    '/favorites',
    '/profile',
    '/premium',
    '/recover',
    '/email/confirm',
    '/link-web',
  ])
  if (exact.has(pathname)) return true
  if (pathname.startsWith('/comics/')) return true
  if (pathname.startsWith('/decks/')) return true
  if (pathname.startsWith('/mode/')) return true
  if (pathname.startsWith('/legal/')) return true
  if (pathname.startsWith('/game/')) return true
  return false
}

/** Host-only create: acquire before opening a multiplayer room. Guests skip. */
export async function ensureHostGameSessionLease(gameId: string): Promise<GameSessionAcquireResult> {
  const result = await acquireGameSessionLease(gameId)
  if (!result.ok && result.limitReached) {
    notifyGameSessionLimitReached()
  }
  return result
}