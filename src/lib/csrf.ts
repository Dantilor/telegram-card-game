import { isWebShell } from '../config/shell'

const CSRF_COOKIE = 'gnh_csrf'

/** Read non-HttpOnly CSRF cookie set by the server after WEB login. */
export function readCsrfToken(): string {
  if (typeof document === 'undefined') return ''
  const parts = document.cookie.split(';')
  for (const part of parts) {
    const idx = part.indexOf('=')
    if (idx <= 0) continue
    const key = part.slice(0, idx).trim()
    if (key !== CSRF_COOKIE) continue
    try {
      return decodeURIComponent(part.slice(idx + 1).trim())
    } catch {
      return part.slice(idx + 1).trim()
    }
  }
  return ''
}

export function csrfHeadersForMutation(method: string): Record<string, string> {
  if (!isWebShell()) return {}
  const m = method.toUpperCase()
  if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return {}
  const token = readCsrfToken()
  return token ? { 'X-CSRF-Token': token } : {}
}
