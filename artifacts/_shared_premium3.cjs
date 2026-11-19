const fs = require('fs')

fs.writeFileSync('server/src/routes/me.ts', `import { Router, Request, Response } from 'express'
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
`)

fs.writeFileSync('server/src/routes/premium.ts', `import { Router, Request, Response } from 'express'
import { resolveAuth } from '../auth/resolveAuth.js'
import { getTelegramPremium, getWebAccountPremium } from '../auth/webAccounts.js'

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
      const status = await getWebAccountPremium(auth.webAccountId)
      safeResponse(res, status.isPremium, status.activeUntil, {
        authSource: auth.source,
        webAccountId: auth.webAccountId,
        sources: status.sources,
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
`)

fs.writeFileSync('server/src/auth/premiumCaller.ts', `import type { Request } from 'express'
import { resolveAuth } from './resolveAuth.js'
import { getTelegramPremium, getWebAccountPremium } from './webAccounts.js'

/**
 * Premium host check for party rooms.
 * Accepts Mini App initData, OIDC WEB session, or anonymous WEB account entitlements.
 * CSRF required on mutating methods for cookie auth.
 */
export async function callerIsPremium(req: Request): Promise<boolean> {
  const mutating = req.method !== 'GET' && req.method !== 'HEAD'
  const auth = await resolveAuth(req, { requireCsrfForWeb: mutating })
  if (!auth) return false
  try {
    if (auth.webAccountId) {
      const status = await getWebAccountPremium(auth.webAccountId)
      return status.isPremium
    }
    if (auth.telegramId) {
      const status = await getTelegramPremium(auth.telegramId)
      return status.isPremium
    }
    return false
  } catch {
    return false
  }
}

/** Optional verified telegram id — never from body. Guests may be anonymous. */
export async function optionalVerifiedTelegramId(req: Request): Promise<number | null> {
  const auth = await resolveAuth(req, { requireCsrfForWeb: false, skipTouch: true })
  return auth?.telegramId ?? null
}
`)

console.log('routes rewritten')
