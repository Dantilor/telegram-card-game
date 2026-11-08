import { resolveApiBase } from './apiBase'
import { isWebShell } from '../config/shell'
import { readCsrfToken } from './csrf'

export type WebSessionMe = {
  ok: boolean
  telegramId: number
  source: string
  sessionId?: number
  displayName?: string | null
  username?: string | null
  pictureUrl?: string | null
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
