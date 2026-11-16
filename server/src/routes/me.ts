import { Router, Request, Response } from 'express'
import { resolveAuth } from '../auth/resolveAuth.js'
import { getTelegramPremium, getWebAccountPremium } from '../auth/webAccounts.js'

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

    const status = await getTelegramPremium(telegramId)
    res.status(200).json({
      telegramId,
      isPremium: status.isPremium,
      premium: status.isPremium,
      premiumUntil: status.activeUntil,
      activeUntil: status.activeUntil,
      sources: status.sources,
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
