import { apiGet } from '../lib/api'
import {
  clearMeInFlightIfCurrent,
  commitMeCache,
  getMeGeneration,
  getMeInFlight,
  invalidateMeCache as invalidateMeCacheCore,
  peekMeCache,
  setMeInFlight,
} from './meCache'

export type MeResponse = {
  telegramId: number | null
  webAccountId?: string | null
  premium: boolean
  premiumUntil?: string | null
  isLifetime?: boolean
  lastEndedAt?: string | null
}

export type PremiumStatusResponse = {
  isPremium: boolean
  activeUntil: string | null
  isLifetime?: boolean
  lastEndedAt?: string | null
}

export class ApiAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ApiAuthError'
  }
}

const ME_CACHE_TTL_MS = 5000

export function invalidateMeCache(): void {
  invalidateMeCacheCore()
}

/** Кэш на 5 с и дедупликация запросов: prefetch и usePremiumStatus не дергают API дважды. */
export async function getMe(): Promise<MeResponse> {
  const cached = peekMeCache(ME_CACHE_TTL_MS)
  if (cached) return cached

  const inFlight = getMeInFlight()
  if (inFlight) return inFlight

  const generation = getMeGeneration()
  let promise!: Promise<MeResponse>
  promise = (async () => {
    try {
      const data = await apiGet<MeResponse>('/api/me')
      commitMeCache(data, generation)
      return data
    } catch (e) {
      const err = e as Error & { status?: number }
      if (err.status === 401) {
        throw new ApiAuthError('Не удалось подтвердить Telegram initData')
      }
      throw e
    } finally {
      clearMeInFlightIfCurrent(promise)
    }
  })()
  setMeInFlight(promise)
  return promise
}

export async function getPremiumStatus(): Promise<PremiumStatusResponse> {
  const me = await getMe()
  return {
    isPremium: me.premium,
    activeUntil: me.premiumUntil ?? null,
    isLifetime: me.isLifetime,
    lastEndedAt: me.lastEndedAt ?? null,
  }
}
