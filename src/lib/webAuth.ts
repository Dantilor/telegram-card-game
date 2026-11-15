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

export async function startEmailBind(email: string): Promise<{
  ok: boolean
  expiresAt?: string
  code?: string
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
  return (await res.json()) as { ok: boolean; expiresAt?: string; code?: string }
}

export async function verifyEmailBind(email: string, code: string): Promise<{ ok: boolean; email?: string }> {
  const csrf = readCsrfToken()
  const res = await fetch(`${apiBase()}/api/web/email/bind/verify`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
    },
    body: JSON.stringify({ email, code }),
  })
  if (!res.ok) {
    const err = new Error('email_bind_verify_failed') as Error & { status?: number }
    err.status = res.status
    throw err
  }
  return (await res.json()) as { ok: boolean; email?: string }
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
