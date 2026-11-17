import { Router, Request, Response } from 'express'
import { getPlansCatalog } from '../services/plansCatalog.js'

const router = Router()

router.get('/plans', async (req: Request, res: Response) => {
  try {
    const { payload, etag, cacheHit, sqlMs } = await getPlansCatalog()
    res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=60')
    res.setHeader('ETag', etag)
    res.setHeader('X-GNH-Cache', cacheHit ? 'HIT' : 'MISS')
    if (sqlMs != null) res.setHeader('Server-Timing', `sql;dur=${Math.round(sqlMs)}`)
    if (req.headers['if-none-match'] === etag) {
      res.status(304).end()
      return
    }
    res.status(200).json(payload)
  } catch (e) {
    console.error('[API] GET /api/plans error:', e instanceof Error ? e.message : 'error')
    res.setHeader('Cache-Control', 'no-store')
    res.status(500).json({ ok: false, error: 'plans_unavailable' })
  }
})

export default router
