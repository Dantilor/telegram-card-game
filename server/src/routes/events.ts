import { Router, Request, Response } from 'express'
import { handleAnalyticsEvent } from '../legal/analytics.js'
import { db } from '../legal/runtime.js'

const router = Router()

router.post('/events', async (req: Request, res: Response) => {
  try {
    const header = req.headers['x-telegram-init-data']
    const initData = typeof header === 'string' ? header : req.body?.initData
    const result = await handleAnalyticsEvent({
      query: db,
      botToken: process.env.TELEGRAM_BOT_TOKEN ?? process.env.BOT_TOKEN ?? '',
      initData,
      name: req.body?.name,
      props: req.body?.props,
    })
    res.status(result.status).json(result.body)
  } catch (error) {
    console.warn('[API] /api/events failed:', error instanceof Error ? error.message : 'error')
    if (!res.headersSent) res.status(503).json({ ok: false, error: 'analytics_unavailable' })
  }
})

export default router
