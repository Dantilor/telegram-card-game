import { resolveApiBase } from './apiBase'
import { isWebShell } from '../config/shell'
import { readCsrfToken } from './csrf'

export type WebSessionMe = {
  ok: boolean
  telegramId?: number | null
  webAccountId?: string | null
  source: string
  sessionId?: number
  displayName?: string | null
  username?: string | null
  pictureUrl?: string | null
  /** Saved purchase-recovery email (verified or pending). */
  email?: string | null
  emailVerified?: boolean
  emailPending?: boolean
  premium?: {
    isPremium: boolean
    activeUntil: string | null
    sources?: string[]
  }
}

function apiBase(): string {
  if (isWebShell()) {
    const url = (import.meta.env.VITE_API_URL as string | undefined)?.trim()
    const base = (import.meta.env.VITE_API_BASE as string | undefined)?.trim()
    if (!url && !base) return ''
  }
  return resolveApiBase(import.meta.env)
}

export function buildTelegramLoginUrl(returnTo = '/'): string {
  const path = returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/'
  const qs = new URLSearchParams({
    redirect: '1',
    return_to: path,
  })
  return `${apiBase()}/api/web/auth/telegram/start?${qs.toString()}`
}

/** Create or resume anonymous WEB session (no registration). */
export async function ensureWebSession(): Promise<WebSessionMe | null> {
  const res = await fetch(`${apiBase()}/api/web/session/ensure`, {
    method: 'POST',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) return null
  // After ensure, load full profile (premium, display).
  return fetchWebSessionMe()
}

export async function fetchWebSessionMe(): Promise<WebSessionMe | null> {
  const res = await fetch(`${apiBase()}/api/web/session/me`, {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  if (res.status === 401) return null
  if (!res.ok) {
    const err = new Error(`session_me_${res.status}`) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  return (await res.json()) as WebSessionMe
}

export async function logoutWebSession(): Promise<void> {
  const csrf = readCsrfToken()
  await fetch(`${apiBase()}/api/web/auth/logout`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
    },
  })
}

export async function startTelegramLinkRestore(): Promise<{
  ok: boolean
  expiresAt?: string
  instruction?: string
  code?: string
}> {
  const csrf = readCsrfToken()
  const res = await fetch(`${apiBase()}/api/web/telegram-link/start`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
    },
  })
  if (!res.ok) {
    const err = new Error('telegram_link_start_failed') as Error & { status?: number }
    err.status = res.status
    throw err
  }
  return (await res.json()) as { ok: boolean; expiresAt?: string; instruction?: string; code?: string }
}

export async function fetchTelegramLinkStatus(): Promise<{
  ok: boolean
  linked: boolean
  telegramId: string | null
  linkedAt: string | null
  pendingChallengeExpiresAt: string | null
  isPremium: boolean
  activeUntil: string | null
  sources: string[]
}> {
  const res = await fetch(`${apiBase()}/api/web/telegram-link/status`, {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    const err = new Error('telegram_link_status_failed') as Error & { status?: number }
    err.status = res.status
    throw err
  }
  return (await res.json()) as {
    ok: boolean
    linked: boolean
    telegramId: string | null
    linkedAt: string | null
    pendingChallengeExpiresAt: string | null
    isPremium: boolean
    activeUntil: string | null
    sources: string[]
  }
}

/** Complete WEB↔Telegram link from Mini App (initData + 8-digit code). */
export async function completeTelegramLink(code: string): Promise<{
  ok: boolean
  premium?: boolean
  activeUntil?: string | null
}> {
  const { getInitData } = await import('./telegram')
  const initData = getInitData()
  if (!initData) {
    const err = new Error('telegram_init_required') as Error & { status?: number }
    err.status = 401
    throw err
  }
  const res = await fetch(`${apiBase()}/api/web/telegram-link/complete`, {
    method: 'POST',
    credentials: 'omit',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-telegram-init-data': initData,
    },
    body: JSON.stringify({ code: code.trim() }),
  })
  if (!res.ok) {
    const err = new Error('telegram_link_complete_failed') as Error & { status?: number; code?: string }
    err.status = res.status
    try {
      const body = (await res.json()) as { code?: string }
      if (typeof body.code === 'string') err.code = body.code
    } catch {
      /* ignore */
    }
    throw err
  }
  return (await res.json()) as { ok: boolean; premium?: boolean; activeUntil?: string | null }
}

export async function unlinkTelegramLink(): Promise<{
  ok: boolean
  linked: boolean
  revoked: boolean
  isPremium?: boolean
  activeUntil?: string | null
  sources?: string[]
}> {
  const csrf = readCsrfToken()
  const res = await fetch(`${apiBase()}/api/web/telegram-link/unlink`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
    },
  })
  if (!res.ok) {
    const err = new Error('telegram_link_unlink_failed') as Error & { status?: number }
    err.status = res.status
    throw err
  }
  return (await res.json()) as {
    ok: boolean
    linked: boolean
    revoked: boolean
    isPremium?: boolean
    activeUntil?: string | null
    sources?: string[]
  }
}

export async function startEmailBind(email: string): Promise<{
  ok: boolean
  expiresAt?: string
  token?: string
}> {
  const csrf = readCsrfToken()
  const res = await fetch(`${apiBase()}/api/web/email/bind/start`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
    },
    body: JSON.stringify({ email }),
  })
  if (!res.ok) {
    const err = new Error('email_bind_start_failed') as Error & { status?: number }
    err.status = res.status
    throw err
  }
  return (await res.json()) as { ok: boolean; expiresAt?: string; token?: string }
}

export async function startEmailRecover(email: string): Promise<{
  ok: boolean
  expiresAt?: string
  token?: string
}> {
  const res = await fetch(`${apiBase()}/api/web/email/recover/start`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  })
  if (!res.ok) {
    const err = new Error('email_recover_start_failed') as Error & { status?: number }
    err.status = res.status
    throw err
  }
  return (await res.json()) as { ok: boolean; expiresAt?: string; token?: string }
}

/** Complete magic-link via intentional POST (not on page load / mail prefetch). */
export async function completeEmailMagicLink(token: string): Promise<{
  ok: boolean
  webAccountId?: string
  email?: string
  purpose?: string
}> {
  const res = await fetch(`${apiBase()}/api/web/email/confirm`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token }),
  })
  if (!res.ok) {
    const err = new Error('email_confirm_failed') as Error & { status?: number }
    err.status = res.status
    throw err
  }
  return (await res.json()) as {
    ok: boolean
    webAccountId?: string
    email?: string
    purpose?: string
  }
}

/** Local-only helper when WEB_DEV_LOGIN_ENABLED is on the server. */
export async function devLoginWeb(input: {
  telegramId: number
  secret: string
  displayName?: string
}): Promise<WebSessionMe> {
  const res = await fetch(`${apiBase()}/api/web/auth/dev-login`, {
    method: 'POST',
    credentials: 'include',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const err = new Error('dev_login_failed') as Error & { status?: number }
    err.status = res.status
    throw err
  }
  const data = (await res.json()) as { telegramId: number }
  return {
    ok: true,
    telegramId: data.telegramId,
    source: 'web_session',
    displayName: input.displayName ?? 'Dev Host',
  }
}
