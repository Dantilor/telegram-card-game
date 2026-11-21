import { Router, Request, Response } from 'express'
import { resolveAuth } from '../auth/resolveAuth.js'
import { getTelegramPremium, getWebAccountPremium } from '../auth/webAccounts.js'
import { readDeviceTokenHash } from '../auth/webDeviceRequest.js'

const isDev = process.env.NODE_ENV !== 'production'

function safeResponse(
  res: Response,
  isPremium: boolean,
  activeUntil: string | null,
  extra?: Record<string, unknown>
) {
  res.status(200).json({ isPremium, activeUntil, ...extra })
}

const router = Router()

router.get('/premium-status', async (req: Request, res: Response) => {
  const auth = await resolveAuth(req)
  if (!auth) {
    if (isDev) console.log('[TCG] /premium-status: no auth')
    safeResponse(res, false, null)
    return
  }

  try {
    if (auth.webAccountId) {
      const status = await getWebAccountPremium(auth.webAccountId, undefined, {
        deviceTokenHash: readDeviceTokenHash(req),
      })
      safeResponse(res, status.isPremium, status.activeUntil, {
        authSource: auth.source,
        webAccountId: auth.webAccountId,
        sources: status.sources,
        isLifetime: status.isLifetime,
        lastEndedAt: status.lastEndedAt,
      })
      return
    }

    const telegram_id = auth.telegramId
    if (!telegram_id) {
      safeResponse(res, false, null)
      return
    }

    const status = await getTelegramPremium(telegram_id)
    safeResponse(res, status.isPremium, status.activeUntil, {
      authSource: auth.source,
      sources: status.sources,
      isLifetime: status.isLifetime,
      lastEndedAt: status.lastEndedAt,
    })
  } catch (e: unknown) {
    if (isDev) {
      const err = e instanceof Error ? e.message : String(e)
      console.warn('[TCG] /premium-status error:', err)
    }
    safeResponse(res, false, null)
  }
})

export default router
