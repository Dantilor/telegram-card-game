import type { Request, Response } from 'express'

export const SESSION_COOKIE = process.env.WEB_SESSION_COOKIE_NAME?.trim() || 'gnh_sid'
export const CSRF_COOKIE = process.env.WEB_CSRF_COOKIE_NAME?.trim() || 'gnh_csrf'

export function cookieSecure(): boolean {
  if (process.env.WEB_COOKIE_SECURE === '0' || process.env.WEB_COOKIE_SECURE === 'false') return false
  if (process.env.WEB_COOKIE_SECURE === '1' || process.env.WEB_COOKIE_SECURE === 'true') return true
  return process.env.NODE_ENV === 'production'
}

export function parseCookieHeader(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx <= 0) continue
    const key = part.slice(0, idx).trim()
    const raw = part.slice(idx + 1).trim()
    if (!key) continue
    try {
      out[key] = decodeURIComponent(raw)
    } catch {
      out[key] = raw
    }
  }
  return out
}

export function readCookies(req: Request): Record<string, string> {
  return parseCookieHeader(typeof req.headers.cookie === 'string' ? req.headers.cookie : undefined)
}

function serializeCookie(
  name: string,
  value: string,
  opts: {
    httpOnly: boolean
    maxAgeSec: number
    path?: string
    sameSite?: 'Lax' | 'Strict' | 'None'
  }
): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${opts.path ?? '/'}`,
    `Max-Age=${Math.max(0, Math.floor(opts.maxAgeSec))}`,
    `SameSite=${opts.sameSite ?? 'Lax'}`,
  ]
  if (opts.httpOnly) parts.push('HttpOnly')
  if (cookieSecure()) parts.push('Secure')
  return parts.join('; ')
}

export function appendSetCookie(res: Response, cookie: string): void {
  const prev = res.getHeader('Set-Cookie')
  if (!prev) {
    res.setHeader('Set-Cookie', cookie)
    return
  }
  if (Array.isArray(prev)) {
    res.setHeader('Set-Cookie', [...prev, cookie])
    return
  }
  res.setHeader('Set-Cookie', [String(prev), cookie])
}

export function setSessionCookies(
  res: Response,
  input: { sessionToken: string; csrfToken: string; maxAgeSec: number }
): void {
  appendSetCookie(
    res,
    serializeCookie(SESSION_COOKIE, input.sessionToken, {
      httpOnly: true,
      maxAgeSec: input.maxAgeSec,
      sameSite: 'Lax',
    })
  )
  appendSetCookie(
    res,
    serializeCookie(CSRF_COOKIE, input.csrfToken, {
      httpOnly: false,
      maxAgeSec: input.maxAgeSec,
      sameSite: 'Lax',
    })
  )
}

export function clearSessionCookies(res: Response): void {
  appendSetCookie(
    res,
    serializeCookie(SESSION_COOKIE, '', { httpOnly: true, maxAgeSec: 0, sameSite: 'Lax' })
  )
  appendSetCookie(
    res,
    serializeCookie(CSRF_COOKIE, '', { httpOnly: false, maxAgeSec: 0, sameSite: 'Lax' })
  )
}
