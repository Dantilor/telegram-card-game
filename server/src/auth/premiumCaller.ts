import type { Request } from 'express'
import { getUserPremiumWithDb } from '../premiumStore.js'
import { resolveAuth } from './resolveAuth.js'

/**
 * Premium host check for party rooms.
 * Accepts Mini App initData or WEB session (CSRF required on mutating methods).
 */
export async function callerIsPremium(req: Request): Promise<boolean> {
  const mutating = req.method !== 'GET' && req.method !== 'HEAD'
  const auth = await resolveAuth(req, { requireCsrfForWeb: mutating })
  if (!auth) return false
  try {
    const status = await getUserPremiumWithDb(auth.telegramId)
    return status.premium
  } catch {
    return false
  }
}

/** Optional verified telegram id — never from body. Guests may be anonymous. */
export async function optionalVerifiedTelegramId(req: Request): Promise<number | null> {
  const auth = await resolveAuth(req, { requireCsrfForWeb: false, skipTouch: true })
  return auth?.telegramId ?? null
}
