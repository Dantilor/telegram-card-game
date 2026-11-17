import { Router, Request, Response } from 'express'
import { getPlansCatalog } from '../services/plansCatalog.js'

const router = Router()

router.get('/plans', async (req: Request, res: Response) => {
  try {
    const { payload, etag, cacheHit, sqlMs } = await getPlansCatalog()
    // no-cache + ETag: clients must revalidate before reuse so a UI price cannot linger
    // after a tariff change. Checkout still reads the live row via getActivePlanById (DB),
    // never this catalog cache. Priced plans must not be served stale from intermediaries.
    res.setHeader('Cache-Control', 'no-cache')
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
