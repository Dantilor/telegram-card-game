/**
 * Telegram initData cache and hash normalization.
 * Parse tgWebAppData from location.hash ONCE at boot, cache in sessionStorage,
 * normalize hash to #/ so HashRouter works. All reads: tg > cache > parse.
 */
const TG_INIT_CACHE = 'TG_INIT_CACHE'
// Cache key used by the vendored official Telegram WebApp SDK on this origin.
// Seed it before normalizing the hash, so async SDK execution still sees the launch params.
const TG_SDK_INIT_CACHE = '__telegram__initParams'

export type CachedInitData = {
  source: 'hash' | 'webapp'
  userId?: number
  user?: { id?: number; first_name?: string; last_name?: string; username?: string; photo_url?: string }
  chatInstance?: string
  chatType?: string
  initDataRaw?: string
  themeParams?: Record<string, string>
}

function parseTgWebAppData(raw: string): Omit<CachedInitData, 'source'> | null {
  try {
    // URLSearchParams on the outer hash already decoded tgWebAppData once.
    // Decoding again can turn encoded & or % inside signed user fields into new params.
    const initParams = new URLSearchParams(raw)
    const userStr = initParams.get('user')
    let user: CachedInitData['user']
    if (userStr) {
      try {
        user = JSON.parse(userStr) as CachedInitData['user']
      } catch {
        try {
          user = JSON.parse(decodeURIComponent(userStr)) as CachedInitData['user']
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
      initDataRaw: raw,
    }
  } catch {
    return null
  }
}

/**
 * The bundled Telegram SDK reads #tgWebAppData on execution and saves the full
 * launch parameters in sessionStorage under __telegram__initParams. When loaded
 * asynchronously after React, it can restore those same params from this key.
 *
 * Never fabricate an identity: preserve the exact Telegram-supplied signed
 * initData and launch metadata. The server continues validating each request.
 * If storage is blocked, leave the launch hash untouched until SDK execution.
 */
function primeTelegramSdkInitParams(params: URLSearchParams): boolean {
  try {
    const signedData = params.get('tgWebAppData')
    if (!signedData) return false

    let previous: Record<string, string> = {}
    try {
      const raw = sessionStorage.getItem(TG_SDK_INIT_CACHE)
      const parsed: unknown = raw ? JSON.parse(raw) : null
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        previous = Object.fromEntries(
          Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
        )
      }
    } catch {
      // Malformed previous state must not prevent a fresh, signed launch.
    }

    // Match the SDK's urlParseHashParams output (it decodes values once).
    // Preserve version, platform, theme, start parameter and any future tg keys.
    const launchParams = Object.fromEntries(params.entries())
    sessionStorage.setItem(TG_SDK_INIT_CACHE, JSON.stringify({ ...previous, ...launchParams }))
    return true
  } catch {
    return false
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

    const parsed = parseTgWebAppData(tgWebAppData)
    if (!parsed) return null

    const themeParamsStr = params.get('tgWebAppThemeParams')
    let themeParams: Record<string, string> | undefined
    if (themeParamsStr) {
      try {
        themeParams = JSON.parse(themeParamsStr) as Record<string, string>
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
      initDataRaw: parsed.initDataRaw ?? tgWebAppData,
      themeParams,
    }
    // Both caches must be committed before HashRouter removes the launch hash.
    if (!primeTelegramSdkInitParams(params)) return null
    sessionStorage.setItem(TG_INIT_CACHE, JSON.stringify(cached))
    normalizeHash()
    return cached
  } catch {
    return null
  }
}

/**
 * Persist signed WebApp.initData for the session.
 * Modern Telegram often leaves hash empty after boot; without this, a later empty
 * `Telegram.WebApp.initData` makes payment think the user is outside Telegram.
 * Never logs or returns secrets to callers beyond the cached object.
 */
export function cacheInitDataFromWebApp(initDataRaw: string): CachedInitData | null {
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') return null
  const raw = typeof initDataRaw === 'string' ? initDataRaw.trim() : ''
  // Keep the exact Telegram string for HMAC; never store a re-decoded variant.
  if (!raw || !raw.includes('auth_date') || !raw.includes('hash=')) return null
  if (!raw.includes('user=') && !raw.includes('chat=')) return null
  try {
    const existing = getCachedInitData()
    if (existing?.initDataRaw === raw) return existing
    const parsed = parseTgWebAppData(raw)
    const cached: CachedInitData = {
      source: 'webapp',
      userId: parsed?.userId,
      user: parsed?.user,
      chatInstance: parsed?.chatInstance,
      chatType: parsed?.chatType,
      initDataRaw: raw,
      themeParams: existing?.themeParams,
    }
    sessionStorage.setItem(TG_INIT_CACHE, JSON.stringify(cached))
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
