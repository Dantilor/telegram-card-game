import { Router, Request, Response } from 'express'
import { getLatestActiveUntil } from '../services/subscriptions.js'
import { resolveAuth } from '../auth/resolveAuth.js'
import { getWebAccountPremium } from '../auth/webAccounts.js'

const router = Router()

router.get('/me', async (req: Request, res: Response) => {
  const auth = await resolveAuth(req)
  if (!auth) {
    res.status(401).json({ error: 'Unauthorized', code: 'unauthorized' })
    return
  }

  try {
    if (auth.webAccountId) {
      const status = await getWebAccountPremium(auth.webAccountId)
      res.status(200).json({
        telegramId: null,
        webAccountId: auth.webAccountId,
        isPremium: status.isPremium,
        premium: status.isPremium,
        premiumUntil: status.activeUntil,
        activeUntil: status.activeUntil,
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

    const activeUntilDate = await getLatestActiveUntil(telegramId)
    const now = new Date()
    const premium = activeUntilDate != null && activeUntilDate > now
    const activeUntil = activeUntilDate ? activeUntilDate.toISOString() : null

    res.status(200).json({
      telegramId,
      isPremium: premium,
      premium,
      premiumUntil: activeUntil,
      activeUntil,
      authSource: auth.source,
    })
  } catch (e) {
    console.error('[API] /api/me DB error:', e)
    res.status(500).json({
      error: e instanceof Error ? e.message : String(e),
    })
  }
})

export default router
