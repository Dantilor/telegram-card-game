import { Router, Request, Response } from 'express'
import { query } from '../db.js'

const router = Router()

router.get('/plans', async (_req: Request, res: Response) => {
  try {
    const r = await query<{ plan_id: string; title: string; price_rub: number; duration_days: number }>(
      `SELECT plan_id, title, price_rub, duration_days
       FROM plans WHERE is_active = true
       ORDER BY duration_days ASC, price_rub ASC`
    )
    const plans = r.rows.map((row) => ({
      id: row.plan_id,
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
