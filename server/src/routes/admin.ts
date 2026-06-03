import { Router, Request, Response } from 'express'
import { query } from '../db.js'
import { bot } from '../bot.js'

const expectedToken = (process.env.ADMIN_TOKEN ?? '') as string

function getTokenFromRequest(req: Request): string | null {
  const auth = req.headers.authorization
  if (auth && typeof auth === 'string' && auth.startsWith('Bearer ')) {
    return auth.slice(7).trim()
  }
  const xToken = req.headers['x-admin-token']
  if (typeof xToken === 'string') return xToken.trim()
  return null
}

function requireAdmin(req: Request, res: Response, next: () => void): void {
  if (!expectedToken) {
    res.status(503).json({ error: 'ADMIN_TOKEN not configured' })
    return
  }
  const auth = req.headers.authorization
  const token = getTokenFromRequest(req)
  const expected = expectedToken
  console.log('[admin] auth header length=', typeof auth === 'string' ? auth.length : 0, 'expected length=', expected.length)
  if (!token || token !== expectedToken) {
    console.warn('[admin] Unauthorized: received length', token?.length ?? 0, 'expected length', expectedToken.length)
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  next()
}

function parseTelegramId(v: unknown): number | null {
  if (typeof v === 'number' && Number.isInteger(v) && v > 0) return v
  if (typeof v === 'string') {
    const n = parseInt(v, 10)
    if (Number.isInteger(n) && n > 0) return n
  }
  return null
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

type BroadcastReplyMarkup = {
  inline_keyboard: Array<Array<{ text: string; url: string }>>
}

function parseBroadcastReplyMarkup(body: {
  buttonText?: unknown
  buttonUrl?: unknown
}):
  | { error: string }
  | { sendOptions: { parse_mode: 'HTML'; reply_markup?: BroadcastReplyMarkup } } {
  const buttonText = typeof body.buttonText === 'string' ? body.buttonText.trim() : ''
  const buttonUrl = typeof body.buttonUrl === 'string' ? body.buttonUrl.trim() : ''
  const hasText = buttonText.length > 0
  const hasUrl = buttonUrl.length > 0
  if (hasText && !hasUrl) {
    return { error: 'buttonUrl is required when buttonText is provided' }
  }
  if (!hasText && hasUrl) {
    return { error: 'buttonText is required when buttonUrl is provided' }
  }
  let replyMarkup: BroadcastReplyMarkup | undefined
  if (hasText && hasUrl) {
    replyMarkup = {
      inline_keyboard: [[{ text: buttonText, url: buttonUrl }]],
    }
  }
  return {
    sendOptions: {
      parse_mode: 'HTML',
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    },
  }
}

const router = Router()
router.use(requireAdmin)

router.get('/ping', (_req: Request, res: Response) => {
  res.status(200).json({ ok: true })
})

router.post('/grant', async (req: Request, res: Response) => {
  try {
    const telegramId = parseTelegramId(req.body?.telegramId)
    if (telegramId == null) {
      res.status(400).json({ ok: false, error: 'telegramId required (positive integer)' })
      return
    }
    const days = Number.isFinite(Number(req.body?.days)) ? Number(req.body.days) : 180
    const activeUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000)

    await query(
      'INSERT INTO users (telegram_id) VALUES ($1) ON CONFLICT (telegram_id) DO NOTHING',
      [telegramId]
    )
    await query(
      `INSERT INTO subscriptions (telegram_id, plan_id, active_until, created_at)
       VALUES ($1, 'premium', $2, now())
       ON CONFLICT (telegram_id) DO UPDATE SET
         plan_id = EXCLUDED.plan_id,
         active_until = EXCLUDED.active_until`,
      [telegramId, activeUntil]
    )

    const providerPaymentChargeId = `admin-grant-${telegramId}-${Date.now()}`
    await query(
      `INSERT INTO payments (
         telegram_id, provider, plan_id, amount, currency,
         telegram_payment_charge_id, provider_payment_charge_id
       )
       VALUES ($1, 'admin', 'premium', NULL, NULL, NULL, $2)
       ON CONFLICT (provider, provider_payment_charge_id) DO NOTHING`,
      [telegramId, providerPaymentChargeId]
    )

    res.status(200).json({
      ok: true,
      telegramId,
      planId: 'premium',
      activeUntil: activeUntil.toISOString(),
    })
  } catch (e) {
    console.error('[admin] grant error:', e)
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) })
  }
})

router.post('/revoke', async (req: Request, res: Response) => {
  try {
    const telegramId = parseTelegramId(req.body?.telegramId)
    if (telegramId == null) {
      res.status(400).json({ ok: false, error: 'telegramId required (positive integer)' })
      return
    }

    await query(
      'DELETE FROM subscriptions WHERE telegram_id = $1',
      [telegramId]
    )

    res.status(200).json({ ok: true })
  } catch (e) {
    console.error('[admin] revoke error:', e)
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) })
  }
})

router.get('/user/:telegramId', async (req: Request, res: Response) => {
  try {
    const telegramId = parseTelegramId(req.params.telegramId)
    if (telegramId == null) {
      res.status(400).json({ ok: false, error: 'telegramId required (positive integer)' })
      return
    }

    const res_ = await query<{ telegram_id: number; created_at: Date; active_until: Date | null }>(
      `SELECT u.telegram_id, u.created_at, s.active_until
       FROM users u
       LEFT JOIN subscriptions s ON s.telegram_id = u.telegram_id
       WHERE u.telegram_id = $1`,
      [telegramId]
    )

    const row = res_.rows[0]
    if (!row) {
      res.status(404).json({ ok: false, error: 'User not found' })
      return
    }

    const activeUntil = row.active_until ? new Date(row.active_until).toISOString() : null
    const isPremium = row.active_until ? new Date(row.active_until).getTime() > Date.now() : false

    res.status(200).json({
      telegramId: row.telegram_id,
      createdAt: new Date(row.created_at).toISOString(),
      activeUntil,
      isPremium,
    })
  } catch (e) {
    console.error('[admin] user error:', e)
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) })
  }
})

router.post('/broadcast-test', async (req: Request, res: Response) => {
  try {
    if (!bot) {
      res.status(500).json({ ok: false, error: 'Bot is not initialized' })
      return
    }

    const telegramId = parseTelegramId(req.body?.telegramId)
    if (telegramId == null) {
      res.status(400).json({ ok: false, error: 'telegramId required (positive integer)' })
      return
    }

    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : ''
    if (!text) {
      res.status(400).json({ ok: false, error: 'text is required' })
      return
    }

    const buttonParsed = parseBroadcastReplyMarkup(req.body ?? {})
    if ('error' in buttonParsed) {
      res.status(400).json({ ok: false, error: buttonParsed.error })
      return
    }

    await bot.telegram.sendMessage(telegramId, text, buttonParsed.sendOptions)

    res.status(200).json({ ok: true, telegramId })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[admin] broadcast-test error:', message)
    res.status(500).json({ ok: false, error: message })
  }
})

router.post('/broadcast', async (req: Request, res: Response) => {
  try {
    if (!bot) {
      res.status(500).json({ ok: false, error: 'Bot is not initialized' })
      return
    }

    const rawText = typeof req.body?.text === 'string' ? req.body.text.trim() : ''
    if (!rawText) {
      res.status(400).json({ ok: false, error: 'text is required' })
      return
    }

    const buttonParsed = parseBroadcastReplyMarkup(req.body ?? {})
    if ('error' in buttonParsed) {
      res.status(400).json({ ok: false, error: buttonParsed.error })
      return
    }

    const rawLimit = Number(req.body?.limit)
    const rawOffset = Number(req.body?.offset)

    let limit = Number.isFinite(rawLimit) ? rawLimit : 10
    if (limit < 1) limit = 1
    if (limit > 100) limit = 100

    let offset = Number.isFinite(rawOffset) ? rawOffset : 0
    if (offset < 0) offset = 0

    const result = await query<{ telegram_id: number }>(
      `SELECT telegram_id
       FROM users
       ORDER BY created_at ASC, telegram_id ASC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    )

    const rows = result.rows
    const totalSelected = rows.length

    let sentCount = 0
    let failedCount = 0
    const failures: Array<{ telegramId: number; error: string }> = []

    for (const row of rows) {
      const telegramId = row.telegram_id
      try {
        await bot.telegram.sendMessage(telegramId, rawText, buttonParsed.sendOptions)
        sentCount += 1
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        console.warn('[admin] broadcast error for telegramId=', telegramId, message)
        failedCount += 1
        failures.push({ telegramId, error: message })
      }
      await sleep(50)
    }

    res.status(200).json({
      ok: true,
      limit,
      offset,
      totalSelected,
      sentCount,
      failedCount,
      failures,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[admin] broadcast fatal error:', message)
    res.status(500).json({ ok: false, error: message })
  }
})

router.post('/broadcast-photo-test', async (req: Request, res: Response) => {
  try {
    if (!bot) {
      res.status(500).json({ ok: false, error: 'Bot not initialized' })
      return
    }

    const telegramId = parseTelegramId(req.body?.telegramId)
    if (telegramId == null) {
      res.status(400).json({ ok: false, error: 'telegramId required (positive integer)' })
      return
    }

    const photo = typeof req.body?.photo === 'string' ? req.body.photo.trim() : ''
    if (!photo) {
      res.status(400).json({ ok: false, error: 'photo required (non-empty string)' })
      return
    }

    const caption = typeof req.body?.caption === 'string' ? req.body.caption : ''
    if (!caption.trim()) {
      res.status(400).json({ ok: false, error: 'caption required (non-empty string)' })
      return
    }

    const buttonParsed = parseBroadcastReplyMarkup(req.body ?? {})
    if ('error' in buttonParsed) {
      res.status(400).json({ ok: false, error: buttonParsed.error })
      return
    }

    await bot.telegram.sendPhoto(telegramId, photo, {
      caption,
      parse_mode: 'HTML',
      ...(buttonParsed.sendOptions.reply_markup
        ? { reply_markup: buttonParsed.sendOptions.reply_markup }
        : {}),
    })
    res.status(200).json({ ok: true, telegramId })
  } catch (e) {
    console.error('[admin] broadcast-photo-test error:', e)
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) })
  }
})

router.post('/broadcast-photo', async (req: Request, res: Response) => {
  try {
    if (!bot) {
      res.status(500).json({ ok: false, error: 'Bot not initialized' })
      return
    }

    const photo = typeof req.body?.photo === 'string' ? req.body.photo.trim() : ''
    if (!photo) {
      res.status(400).json({ ok: false, error: 'photo required (non-empty string)' })
      return
    }

    const caption = typeof req.body?.caption === 'string' ? req.body.caption : ''
    if (!caption.trim()) {
      res.status(400).json({ ok: false, error: 'caption required (non-empty string)' })
      return
    }

    const buttonParsed = parseBroadcastReplyMarkup(req.body ?? {})
    if ('error' in buttonParsed) {
      res.status(400).json({ ok: false, error: buttonParsed.error })
      return
    }

    const rawLimit = Number(req.body?.limit)
    const rawOffset = Number(req.body?.offset)
    const limit = Math.max(1, Math.min(100, Number.isFinite(rawLimit) ? Math.trunc(rawLimit) : 10))
    const offset = Math.max(0, Number.isFinite(rawOffset) ? Math.trunc(rawOffset) : 0)

    const usersRes = await query<{ telegram_id: number }>(
      `SELECT telegram_id
       FROM users
       ORDER BY created_at ASC, telegram_id ASC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    )

    let sentCount = 0
    let failedCount = 0
    const failures: Array<{ telegramId: number; error: string }> = []

    for (const row of usersRes.rows) {
      const telegramId = row.telegram_id
      try {
        await bot.telegram.sendPhoto(telegramId, photo, {
          caption,
          parse_mode: 'HTML',
          ...(buttonParsed.sendOptions.reply_markup
            ? { reply_markup: buttonParsed.sendOptions.reply_markup }
            : {}),
        })
        sentCount += 1
      } catch (e) {
        failedCount += 1
        failures.push({
          telegramId,
          error: e instanceof Error ? e.message : String(e),
        })
      }
      await sleep(50)
    }

    res.status(200).json({
      ok: true,
      limit,
      offset,
      totalSelected: usersRes.rows.length,
      sentCount,
      failedCount,
      failures,
    })
  } catch (e) {
    console.error('[admin] broadcast-photo error:', e)
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) })
  }
})

router.post('/broadcast-photo-since', async (req: Request, res: Response) => {
  try {
    if (!bot) {
      res.status(500).json({ ok: false, error: 'Bot is not initialized' })
      return
    }

    const photo = typeof req.body?.photo === 'string' ? req.body.photo.trim() : ''
    if (!photo) {
      res.status(400).json({ ok: false, error: 'photo required (non-empty string)' })
      return
    }

    const caption = typeof req.body?.caption === 'string' ? req.body.caption : ''
    if (!caption.trim()) {
      res.status(400).json({ ok: false, error: 'caption required (non-empty string)' })
      return
    }

    const createdAfter =
      typeof req.body?.createdAfter === 'string' ? req.body.createdAfter.trim() : ''
    if (!createdAfter) {
      res.status(400).json({ ok: false, error: 'createdAfter is required' })
      return
    }

    const buttonParsed = parseBroadcastReplyMarkup(req.body ?? {})
    if ('error' in buttonParsed) {
      res.status(400).json({ ok: false, error: buttonParsed.error })
      return
    }

    const rawLimit = Number(req.body?.limit)
    const rawOffset = Number(req.body?.offset)
    const limit = Math.max(1, Math.min(100, Number.isFinite(rawLimit) ? Math.trunc(rawLimit) : 10))
    const offset = Math.max(0, Number.isFinite(rawOffset) ? Math.trunc(rawOffset) : 0)

    const usersRes = await query<{ telegram_id: number }>(
      `SELECT telegram_id
       FROM users
       WHERE created_at > $1
       ORDER BY created_at ASC, telegram_id ASC
       LIMIT $2 OFFSET $3`,
      [createdAfter, limit, offset]
    )

    let sentCount = 0
    let failedCount = 0
    const failures: Array<{ telegramId: number; error: string }> = []

    for (const row of usersRes.rows) {
      const telegramId = row.telegram_id
      try {
        await bot.telegram.sendPhoto(telegramId, photo, {
          caption,
          parse_mode: 'HTML',
          ...(buttonParsed.sendOptions.reply_markup
            ? { reply_markup: buttonParsed.sendOptions.reply_markup }
            : {}),
        })
        sentCount += 1
      } catch (e) {
        failedCount += 1
        failures.push({
          telegramId,
          error: e instanceof Error ? e.message : String(e),
        })
      }
      await sleep(50)
    }

    res.status(200).json({
      ok: true,
      createdAfter,
      limit,
      offset,
      totalSelected: usersRes.rows.length,
      sentCount,
      failedCount,
      failures,
    })
  } catch (e) {
    console.error('[admin] broadcast-photo-since error:', e)
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) })
  }
})

export default router
