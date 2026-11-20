import { Router, Request, Response } from 'express'
import { getPlansCatalog, type PlansAudienceFilter } from '../services/plansCatalog.js'

const router = Router()

function parseAudience(raw: unknown): PlansAudienceFilter {
  const v = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  if (v === 'web') return 'web'
  if (v === 'all') return 'all'
  // Default telegram keeps Mini App / legacy clients on current prices.
  return 'telegram'
}

router.get('/plans', async (req: Request, res: Response) => {
  try {
    const audience = parseAudience(req.query.audience)
    const { payload, etag, cacheHit, sqlMs } = await getPlansCatalog(audience)
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
