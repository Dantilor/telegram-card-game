import { getBaseUrl } from './api'
import { getInitData } from './telegram'
import { isWebShell } from '../config/shell'
import { csrfHeadersForMutation } from './csrf'

/**
 * Authenticated fetch for party game APIs.
 * WEB: credentials + CSRF. Mini App: initData header. Never forges telegram ids.
 */
export async function partyFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(typeof init.headers === 'object' && !(init.headers instanceof Headers)
      ? (init.headers as Record<string, string>)
      : {}),
    ...csrfHeadersForMutation(method),
  }
  if (!isWebShell()) {
    const initData = getInitData()
    if (initData) headers['x-telegram-init-data'] = initData
  }

  const url = path.startsWith('http') ? path : `${getBaseUrl()}${path}`
  return fetch(url, {
    ...init,
    method,
    headers,
    credentials: isWebShell() ? 'include' : 'omit',
    cache: 'no-store',
  })
}
