import type { Request } from 'express'
import { resolveAuth } from './resolveAuth.js'
import { getTelegramPremium, getWebAccountPremium } from './webAccounts.js'
import { readDeviceTokenHash } from './webDeviceRequest.js'

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
      const status = await getWebAccountPremium(auth.webAccountId, undefined, {
        deviceTokenHash: readDeviceTokenHash(req),
      })
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
