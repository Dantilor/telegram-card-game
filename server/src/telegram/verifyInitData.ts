import crypto from 'node:crypto'

/**
 * Validates Telegram WebApp initData per:
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * secret_key = HMAC_SHA256(bot_token, "WebAppData")
 * data_check_string = sorted key=value (excl. hash) joined by \n
 * valid if hex(HMAC_SHA256(data_check_string, secret_key)) === hash
 */
export function verifyInitData(
  initData: string,
  botToken: string
): { telegram_id: number; user: Record<string, unknown> } {
  if (!initData?.trim() || !botToken?.trim()) {
    const err = new Error('Invalid initData or botToken') as Error & { status?: number }
    err.status = 401
    throw err
  }

  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) {
    const err = new Error('Missing hash in initData') as Error & { status?: number }
    err.status = 401
    throw err
  }

  params.delete('hash')
  const sortedKeys = [...params.keys()].sort()
  const dataCheckString = sortedKeys
    .map((k) => `${k}=${params.get(k)}`)
    .join('\n')

  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest()

  const computedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex')

  if (computedHash !== hash) {
    const err = new Error('Invalid initData signature') as Error & { status?: number }
    err.status = 401
    throw err
  }

  const userStr = params.get('user')
  let user: Record<string, unknown> = {}
  let telegramId = 0

  if (userStr) {
    try {
      user = JSON.parse(decodeURIComponent(userStr)) as Record<string, unknown>
      const id = user.id
      if (typeof id === 'number') telegramId = id
      else if (typeof id === 'string') telegramId = parseInt(id, 10)
    } catch {
      const err = new Error('Invalid user in initData') as Error & { status?: number }
      err.status = 401
      throw err
    }
  }

  const authDate = params.get('auth_date')
  if (authDate) {
    const ts = parseInt(authDate, 10)
    const maxAge = 24 * 60 * 60 // 24 hours
    if (Date.now() / 1000 - ts > maxAge) {
      const err = new Error('initData expired') as Error & { status?: number }
      err.status = 401
      throw err
    }
  }

  if (!telegramId) {
    const err = new Error('No telegram_id in initData') as Error & { status?: number }
    err.status = 401
    throw err
  }

  return { telegram_id: telegramId, user }
}
