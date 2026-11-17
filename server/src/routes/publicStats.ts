import { Router, Request, Response } from 'express'
import { query } from '../db.js'

const router = Router()

router.get('/public-stats', async (_req: Request, res: Response) => {
  try {
    const r = await query<{ users_count: number }>(
      'SELECT COUNT(*)::int AS users_count FROM users',
    )
    const usersCount = r.rows[0]?.users_count ?? 0
    res.status(200).json({ usersCount })
  } catch (e) {
    console.error('[API] GET /api/public-stats error:', e)
    res.status(500).json({ error: 'Failed to load public stats' })
  }
})

export default router
