/**
 * Telegram initData cache and hash normalization.
 * Parse tgWebAppData from location.hash ONCE at boot, cache in sessionStorage,
 * normalize hash to #/ so HashRouter works. All reads: tg > cache > parse.
 */
const TG_INIT_CACHE = 'TG_INIT_CACHE'

export type CachedInitData = {
  source: 'hash'
  userId?: number
  user?: { id?: number; first_name?: string; last_name?: string; username?: string; photo_url?: string }
  chatInstance?: string
  chatType?: string
  initDataRaw?: string
  themeParams?: Record<string, string>
}

function parseTgWebAppData(raw: string): Omit<CachedInitData, 'source'> | null {
  try {
    const decoded = decodeURIComponent(raw)
    const initParams = new URLSearchParams(decoded)
    const userStr = initParams.get('user')
    let user: CachedInitData['user']
    if (userStr) {
      try {
        user = JSON.parse(decodeURIComponent(userStr)) as CachedInitData['user']
      } catch {
        try {
          user = JSON.parse(userStr) as CachedInitData['user']
        } catch {
          // ignore
        }
      }
    }
    const userId = user?.id != null ? user.id : undefined
    const hasData = user != null || initParams.get('auth_date')
    if (!hasData) return null
    return {
      userId,
      user,
      chatInstance: initParams.get('chat_instance') ?? undefined,
      chatType: initParams.get('chat_type') ?? undefined,
      initDataRaw: decoded,
    }
  } catch {
    return null
  }
}

/** Replace #tgWebAppData=... with #/ so HashRouter works. Keeps search params. */
export function normalizeHash(): void {
  if (typeof window === 'undefined') return
  const hash = window.location.hash
  const hasTgData = hash.startsWith('#tgWebAppData=') || hash.includes('tgWebAppData=')
  if (!hasTgData) return
  const search = window.location.search || ''
  history.replaceState(null, '', window.location.pathname + search + '#/')
}

/**
 * Parse tgWebAppData from hash, cache to sessionStorage, normalize hash.
 * Call once at boot before mounting React. Returns cached InitData or null.
 */
export function parseAndCacheFromHash(): CachedInitData | null {
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') return null
  const hash = window.location.hash
  const hasTgData = hash.startsWith('#tgWebAppData=') || hash.includes('tgWebAppData=')
  if (!hasTgData) return null

  try {
    const hashPart = hash.slice(1)
    const queryPart = hashPart.includes('?') ? hashPart.split('?').slice(1).join('?') : hashPart
    const params = new URLSearchParams(queryPart)
    const tgWebAppData = params.get('tgWebAppData')
    if (!tgWebAppData) return null

    const decoded = decodeURIComponent(tgWebAppData)
    const parsed = parseTgWebAppData(tgWebAppData)
    if (!parsed) return null

    const themeParamsStr = params.get('tgWebAppThemeParams')
    let themeParams: Record<string, string> | undefined
    if (themeParamsStr) {
      try {
        themeParams = JSON.parse(decodeURIComponent(themeParamsStr)) as Record<string, string>
      } catch {
        // ignore
      }
    }

    const cached: CachedInitData = {
      source: 'hash',
      userId: parsed.userId,
      user: parsed.user,
      chatInstance: parsed.chatInstance,
      chatType: parsed.chatType,
      initDataRaw: parsed.initDataRaw ?? decoded,
      themeParams,
    }
    sessionStorage.setItem(TG_INIT_CACHE, JSON.stringify(cached))
    normalizeHash()
    return cached
  } catch {
    return null
  }
}

/** Read initData from sessionStorage. Returns null if not cached. */
export function getCachedInitData(): CachedInitData | null {
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(TG_INIT_CACHE)
    if (!raw) return null
    return JSON.parse(raw) as CachedInitData
  } catch {
    return null
  }
}
