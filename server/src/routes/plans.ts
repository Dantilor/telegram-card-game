import { Router, Request, Response } from 'express'
import { query } from '../db.js'

const router = Router()

router.get('/plans', async (_req: Request, res: Response) => {
  try {
    const r = await query<{ id: string; title: string; price_rub: number; duration_days: number }>(
      `SELECT id, title, price_rub, duration_days
       FROM plans WHERE is_active = true
       ORDER BY price_rub ASC`
    )
    const plans = r.rows.map((row) => ({
      id: row.id,
      title: row.title,
      priceRub: row.price_rub,
      durationDays: row.duration_days,
    }))
    res.status(200).json({ ok: true, plans })
  } catch (e) {
    console.error('[API] GET /api/plans error:', e)
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) })
  }
})

export default router
