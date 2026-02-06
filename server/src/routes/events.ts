import { Router, Request, Response } from 'express'
import { verifyInitData } from '../telegram/verifyInitData.js'
import { query } from '../db.js'

const PROPS_MAX_BYTES = 8 * 1024 // 8kb
const SENSITIVE_KEYS = [
  'initData',
  'init_data',
  'token',
  'access_token',
  'refresh_token',
  'auth',
  'password',
  'provider_payment_charge_id',
  'telegram_payment_charge_id',
  'charge_id',
  'invoice_payload',
]

function toInitDataString(v: unknown): string {
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return v.join('')
  return ''
}

function getInitDataFromRequest(req: Request): string | null {
  const raw = req.headers['x-telegram-init-data'] ?? req.body?.initData ?? req.query?.initData
  const s = toInitDataString(raw)
  return s?.trim() || null
}

function sanitizeProps(props: unknown): Record<string, unknown> | null {
  if (props == null) return null
  if (typeof props !== 'object') return null
  const obj = props as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    const lower = k.toLowerCase()
    if (SENSITIVE_KEYS.some((s) => lower.includes(s.toLowerCase()))) continue
    if (v != null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
      const nested = sanitizeProps(v)
      if (nested) out[k] = nested
    } else {
      out[k] = v
    }
  }
  return out
}

const router = Router()

router.post('/events', async (req: Request, res: Response) => {
  const initData = getInitDataFromRequest(req)
  let telegramId: number | null = null
  if (initData) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN ?? process.env.BOT_TOKEN ?? ''
    try {
      const parsed = verifyInitData(initData, botToken)
      telegramId = parsed.telegram_id
    } catch {
      // invalid initData — proceed with null
    }
  }

  const name = req.body?.name
  if (typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ ok: false, error: 'name required and must be non-empty string' })
    return
  }

  let props: Record<string, unknown> | null = null
  if (req.body?.props != null) {
    const raw = sanitizeProps(req.body.props)
    if (raw && Object.keys(raw).length > 0) {
      const str = JSON.stringify(raw)
      if (Buffer.byteLength(str, 'utf8') > PROPS_MAX_BYTES) {
        res.status(400).json({ ok: false, error: 'props too large' })
        return
      }
      props = raw
    }
  }

  try {
    await query(
      `INSERT INTO events (telegram_id, event_name, event_props) VALUES ($1, $2, $3)`,
      [telegramId, name.trim(), props ? JSON.stringify(props) : null]
    )
    res.status(200).json({ ok: true })
  } catch (e) {
    console.warn('[API] /api/events insert failed:', e instanceof Error ? e.message : e)
    res.status(202).json({ ok: false })
  }
})

export default router
