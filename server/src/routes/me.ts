import { Router, Request, Response } from 'express'
import { resolveAuth } from '../auth/resolveAuth.js'
import { getTelegramPremium, getWebAccountPremium } from '../auth/webAccounts.js'
import { readDeviceTokenHash } from '../auth/webDeviceRequest.js'
import { sqlTimingLog } from '../middleware/requestTiming.js'

const router = Router()

router.get('/me', async (req: Request, res: Response) => {
  const auth = await resolveAuth(req)
  if (!auth) {
    res.status(401).json({ error: 'Unauthorized', code: 'unauthorized' })
    return
  }

  try {
    if (auth.webAccountId) {
      const started = process.hrtime.bigint()
      const status = await getWebAccountPremium(auth.webAccountId, undefined, {
        deviceTokenHash: readDeviceTokenHash(req),
      })
      const sqlMs = Number(process.hrtime.bigint() - started) / 1e6
      sqlTimingLog('me.web_premium', sqlMs)
      res.setHeader('Cache-Control', 'no-store')
      res.setHeader('Server-Timing', `sql;dur=${Math.round(sqlMs)}`)
      res.status(200).json({
        telegramId: null,
        webAccountId: auth.webAccountId,
        isPremium: status.isPremium,
        premium: status.isPremium,
        premiumUntil: status.activeUntil,
        activeUntil: status.activeUntil,
        isLifetime: status.isLifetime,
        lastEndedAt: status.lastEndedAt,
        sources: status.sources,
        authSource: auth.source,
      })
      return
    }

    const telegramId = auth.telegramId
    if (!telegramId) {
      res.status(401).json({ error: 'Unauthorized', code: 'unauthorized' })
      return
    }

    const started = process.hrtime.bigint()
    const status = await getTelegramPremium(telegramId)
    const sqlMs = Number(process.hrtime.bigint() - started) / 1e6
    sqlTimingLog('me.subscription', sqlMs)
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Server-Timing', `sql;dur=${Math.round(sqlMs)}`)
    res.status(200).json({
      telegramId,
      isPremium: status.isPremium,
      premium: status.isPremium,
      premiumUntil: status.activeUntil,
      activeUntil: status.activeUntil,
      isLifetime: status.isLifetime,
      lastEndedAt: status.lastEndedAt,
      sources: status.sources,
      authSource: auth.source,
    })
  } catch (e) {
    console.error('[API] /api/me DB error:', e instanceof Error ? e.message : 'error')
    res.setHeader('Cache-Control', 'no-store')
    res.status(500).json({
      error: 'me_unavailable',
    })
  }
})

export default router