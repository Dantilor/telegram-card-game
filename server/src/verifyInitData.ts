import { createHmac } from 'crypto'

const AUTH_MAX_AGE_SEC = 24 * 60 * 60 // 24 hours

export type ParsedInitData = {
  user?: { id: number }
  auth_date: number
}

function parseInitData(initData: string): Record<string, string> {
  const params = new URLSearchParams(initData)
  const out: Record<string, string> = {}
  params.forEach((value, key) => {
    out[key] = value
  })
  return out
}

function validateHash(initData: string, botToken: string): boolean {
  const params = parseInitData(initData)
  const hash = params.hash
  if (!hash) return false
  delete params.hash

  const dataCheckString = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('\n')

  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest()
  const computedHash = createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex')

  return computedHash === hash
}

function validateAuthDate(authDateStr: string): boolean {
  const authDate = parseInt(authDateStr, 10)
  if (Number.isNaN(authDate)) return false
  return Date.now() / 1000 - authDate < AUTH_MAX_AGE_SEC
}

export function verifyAndParseInitData(
  initData: string,
  botToken: string
): ParsedInitData | null {
  if (!initData || !botToken) return null
  if (!validateHash(initData, botToken)) return null
  const params = parseInitData(initData)
  if (!validateAuthDate(params.auth_date || '')) return null
  let user: { id: number } | undefined
  if (params.user) {
    try {
      const u = JSON.parse(params.user) as { id?: number }
      if (typeof u?.id === 'number') user = { id: u.id }
    } catch {
      return null
    }
  }
  return {
    user,
    auth_date: parseInt(params.auth_date || '0', 10),
  }
}
