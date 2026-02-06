import { Router, Request, Response } from 'express'
import { query } from '../db.js'

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
      `INSERT INTO subscriptions (telegram_id, plan_id, active_until)
       VALUES ($1, 'premium', $2)
       ON CONFLICT (telegram_id, plan_id)
       DO UPDATE SET active_until = EXCLUDED.active_until`,
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
      "DELETE FROM subscriptions WHERE telegram_id = $1 AND plan_id = 'premium'",
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
       LEFT JOIN subscriptions s
         ON s.telegram_id = u.telegram_id AND s.plan_id = 'premium'
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

export default router
