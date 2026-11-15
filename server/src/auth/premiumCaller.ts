import type { Request } from 'express'
import { getUserPremiumWithDb } from '../premiumStore.js'
import { resolveAuth } from './resolveAuth.js'
import { getWebAccountPremium } from './webAccounts.js'

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
      const status = await getUserPremiumWithDb(auth.telegramId)
      return status.premium
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
