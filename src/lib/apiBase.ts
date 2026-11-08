const RENDER_HOST = 'telegram-card-game.onrender.com'

export class ApiConfigError extends Error {
  code: 'api_not_configured' | 'api_base_conflict' | 'render_fallback_blocked'

  constructor(code: ApiConfigError['code'], message: string) {
    super(message)
    this.name = 'ApiConfigError'
    this.code = code
  }
}

function clean(value: string | undefined): string {
  return (value ?? '').trim().replace(/\/$/, '')
}

function isWebEnv(env: { VITE_GNH_SHELL?: string; MODE?: string }): boolean {
  const shell = (env.VITE_GNH_SHELL ?? '').trim().toLowerCase()
  if (shell === 'web') return true
  return env.MODE === 'web'
}

/**
 * One public API origin for profile, game, consent, analytics, purchase, and restore.
 * WEB shell with empty VITE_API_* uses same-origin (reverse proxy / Vite proxy).
 */
export function resolveApiBase(env: {
  VITE_API_URL?: string
  VITE_API_BASE?: string
  VITE_GNH_SHELL?: string
  MODE?: string
}): string {
  const url = clean(env.VITE_API_URL)
  const base = clean(env.VITE_API_BASE)
  if (url && base && url !== base) {
    throw new ApiConfigError(
      'api_base_conflict',
      'VITE_API_URL и VITE_API_BASE указывают на разные серверы. Запрос не отправлен.'
    )
  }
  const raw = url || base
  if (!raw) {
    if (isWebEnv({ VITE_GNH_SHELL: env.VITE_GNH_SHELL, MODE: env.MODE ?? import.meta.env.MODE })) {
      return ''
    }
    throw new ApiConfigError('api_not_configured', 'Адрес API не задан. Запрос не отправлен.')
  }
  let host = ''
  try {
    host = new URL(raw).host
  } catch {
    throw new ApiConfigError('api_not_configured', 'Адрес API задан некорректно. Запрос не отправлен.')
  }
  if (host === RENDER_HOST) {
    throw new ApiConfigError('render_fallback_blocked', 'Прежний адрес Render не используется. Запрос не отправлен.')
  }
  return raw
}
