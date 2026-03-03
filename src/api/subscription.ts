import { apiGet } from '../lib/api'

export type MeResponse = {
  telegramId: number
  premium: boolean
  premiumUntil?: string
}

export type PremiumStatusResponse = {
  isPremium: boolean
  activeUntil: string | null
}

export class ApiAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ApiAuthError'
  }
}

const ME_CACHE_TTL_MS = 5000
let meCache: { data: MeResponse; ts: number } | null = null
let mePromise: Promise<MeResponse> | null = null

/** Кэш на 5 с и дедупликация запросов: prefetch и usePremiumStatus не дергают API дважды. */
export async function getMe(): Promise<MeResponse> {
  if (meCache && Date.now() - meCache.ts < ME_CACHE_TTL_MS) {
    return meCache.data
  }
  if (mePromise) {
    return mePromise
  }
  mePromise = (async () => {
    try {
      const data = await apiGet<MeResponse>('/api/me')
      meCache = { data, ts: Date.now() }
      return data
    } catch (e) {
      mePromise = null
      const err = e as Error & { status?: number }
      if (err.status === 401) {
        throw new ApiAuthError('Не удалось подтвердить Telegram initData')
      }
      throw e
    } finally {
      mePromise = null
    }
  })()
  return mePromise
}

export async function getPremiumStatus(): Promise<PremiumStatusResponse> {
  const me = await getMe()
  return {
    isPremium: me.premium,
    activeUntil: me.premiumUntil ?? null,
  }
}
