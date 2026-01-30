/**
 * Extract Telegram WebApp params from location.hash once, store in sessionStorage,
 * then replace hash with #/ so HashRouter can work. Call before mounting React.
 */
const STORAGE_KEY = 'tg_webapp_hash_payload'

export type TgHashPayload = {
  tgWebAppData?: string
  tgWebAppThemeParams?: string
  tgWebAppVersion?: string
  tgWebAppPlatform?: string
  /** Parsed init data: user, chat_instance, auth_date, hash, raw */
  parsed?: {
    user?: { id?: number; first_name?: string; last_name?: string; username?: string; photo_url?: string }
    chat_instance?: string
    chat_type?: string
    auth_date?: string
    hash?: string
    raw?: string
  }
}

function parseTgWebAppData(raw: string): NonNullable<TgHashPayload['parsed']> | null {
  try {
    const decoded = decodeURIComponent(raw)
    const initParams = new URLSearchParams(decoded)
    const userStr = initParams.get('user')
    let user: { id?: number; first_name?: string; last_name?: string; username?: string; photo_url?: string } | undefined
    if (userStr) {
      try {
        user = JSON.parse(decodeURIComponent(userStr)) as { id?: number; first_name?: string; last_name?: string; username?: string; photo_url?: string }
      } catch {
        try {
          user = JSON.parse(userStr) as { id?: number; first_name?: string; last_name?: string; username?: string; photo_url?: string }
        } catch {
          // ignore
        }
      }
    }
    return {
      user,
      chat_instance: initParams.get('chat_instance') ?? undefined,
      chat_type: initParams.get('chat_type') ?? undefined,
      auth_date: initParams.get('auth_date') ?? undefined,
      hash: initParams.get('hash') ?? undefined,
      raw: decoded,
    }
  } catch {
    return null
  }
}

/**
 * If location.hash contains tgWebAppData, extract params, save to sessionStorage,
 * replace hash with #/ (preserving search params), and return true.
 * Otherwise return false. Safe to call multiple times; extraction runs once per page load.
 */
export function extractTgFromHashOnce(): boolean {
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') return false
  const hash = window.location.hash
  const hasTgData =
    hash.startsWith('#tgWebAppData=') || hash.includes('tgWebAppData=')
  if (!hasTgData) return false

  try {
    const hashPart = hash.slice(1)
    const queryPart = hashPart.includes('?') ? hashPart.split('?').slice(1).join('?') : hashPart
    const params = new URLSearchParams(queryPart)
    const tgWebAppData = params.get('tgWebAppData')
    if (!tgWebAppData) return false

    const payload: TgHashPayload = {
      tgWebAppData: decodeURIComponent(tgWebAppData),
      tgWebAppThemeParams: params.get('tgWebAppThemeParams') ?? undefined,
      tgWebAppVersion: params.get('tgWebAppVersion') ?? undefined,
      tgWebAppPlatform: params.get('tgWebAppPlatform') ?? undefined,
      parsed: parseTgWebAppData(tgWebAppData) ?? undefined,
    }
    if (payload.parsed) {
      payload.parsed.raw = payload.parsed.raw ?? payload.tgWebAppData
    }

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload))

    const search = window.location.search || ''
    const newUrl = window.location.pathname + search + '#/'
    history.replaceState(null, '', newUrl)
    return true
  } catch {
    return false
  }
}

export function getTgHashPayload(): TgHashPayload | null {
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as TgHashPayload
  } catch {
    return null
  }
}
