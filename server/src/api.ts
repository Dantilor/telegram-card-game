import express, { Request, Response } from 'express'
import { verifyAndParseInitData, type ParsedInitData } from './verifyInitData.js'
import { getUserPremiumWithDb } from './premiumStore.js'
import { query } from './db.js'
import { bot } from './bot.js'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN
const PRICE_MONTH = parseInt(process.env.PRICE_MONTH || '5', 10) // Stars
const PRICE_YEAR = parseInt(process.env.PRICE_YEAR || '50', 10) // Stars

declare global {
  namespace Express {
    interface Request {
      initData?: ParsedInitData
    }
  }
}

function toInitDataString(v: unknown): string {
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return v.join('')
  return ''
}

function verifyInitData(
  req: Request,
  res: Response,
  next: () => void
): void {
  if (!BOT_TOKEN) {
    res.status(503).json({ error: 'TELEGRAM_BOT_TOKEN or BOT_TOKEN not configured' })
    return
  }
  const raw = req.headers['x-telegram-init-data'] ?? (req.body?.initData as string) ?? ''
  const initData = toInitDataString(raw)
  if (!initData?.trim()) {
    res.status(401).json({ error: 'initData required' })
    return
  }
  const parsed = verifyAndParseInitData(initData, BOT_TOKEN)
  if (!parsed?.user?.id) {
    res.status(401).json({ error: 'Invalid or missing initData' })
    return
  }
  req.initData = parsed
  next()
}

const api = express.Router()
api.use(express.json())

// Debug ping — no initData needed
api.get('/debug/ping', (_req: Request, res: Response) => {
  res.status(200).json({ ok: true, time: new Date().toISOString() })
})

// Debug DB — no initData needed, checks pool connection
api.get('/debug/db', async (_req: Request, res: Response) => {
  try {
    const r = await query<{ ok: number }>('select 1 as ok')
    if (r.rows[0]?.ok === 1) {
      res.status(200).json({ ok: true })
    } else {
      res.status(503).json({ ok: false, error: 'Unexpected result' })
    }
  } catch (e) {
    console.warn('[API] /api/debug/db error:', e)
    res.status(503).json({ ok: false, error: e instanceof Error ? e.message : String(e) })
  }
})

api.post('/invoice', verifyInitData, async (req: Request, res: Response) => {
  const plan = req.body?.plan === 'year' ? 'year' : 'month'
  const telegramId = req.initData!.user!.id

  if (!bot) {
    res.status(503).json({ error: 'Bot not available' })
    return
  }

  const amount = plan === 'year' ? PRICE_YEAR : PRICE_MONTH
  const title =
    plan === 'year' ? 'Premium на 1 год' : 'Premium на 30 дней'
  const description =
    plan === 'year'
      ? 'Доступ ко всем колодам на 1 год'
      : 'Доступ ко всем колодам на 30 дней'

  const payload = JSON.stringify({ plan, telegramId })

  try {
    const link = await bot.telegram.createInvoiceLink({
      title,
      description,
      payload,
      provider_token: '',
      currency: 'XTR',
      prices: [{ label: title, amount }],
    })
    res.json({ invoiceLink: link })
  } catch (e) {
    console.error('createInvoiceLink error', e)
    res.status(500).json({ error: 'Failed to create invoice' })
  }
})

api.get('/me', verifyInitData, async (req: Request, res: Response) => {
  const telegramId = req.initData!.user!.id
  try {
    const { premium, premiumUntil, planId } = await getUserPremiumWithDb(telegramId)
    console.log(`[API] /api/me returns premium=${premium} planId=${planId ?? 'null'} premiumUntil=${premiumUntil ?? 'null'}`)
    res.json({
      telegramId,
      premium,
      planId: planId ?? undefined,
      activeUntil: premiumUntil ?? undefined,
      premiumUntil: premiumUntil ?? undefined,
    })
  } catch (e) {
    console.warn('[API] /api/me error:', e instanceof Error ? e.message : e)
    res.status(503).json({ error: 'Service temporarily unavailable' })
  }
})

export default api
