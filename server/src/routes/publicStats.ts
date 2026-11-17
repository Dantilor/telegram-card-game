import { Router, Request, Response } from 'express'
import { getPublicStats } from '../services/publicStatsCache.js'

const router = Router()

router.get('/public-stats', async (_req: Request, res: Response) => {
  try {
    const { payload, cacheHit } = await getPublicStats()
    // Decorative count only — short public cache is safe; never put personal fields here.
    // Decorative counter only — short public cache is fine (not used for payments).
    res.setHeader('Cache-Control', 'public, max-age=60')
    res.setHeader('X-GNH-Cache', cacheHit ? 'HIT' : 'MISS')
    res.status(200).json(payload)
  } catch (e) {
    console.error('[API] GET /api/public-stats error:', e instanceof Error ? e.message : 'error')
    res.setHeader('Cache-Control', 'no-store')
    res.status(500).json({ error: 'Failed to load public stats' })
  }
})

export default router
