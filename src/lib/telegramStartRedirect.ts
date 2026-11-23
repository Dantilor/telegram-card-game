/** Pure helpers for Mini App startapp to in-app route mapping. */

export function isWebLinkStartParam(param: string): boolean {
  return /^wl_[A-Za-z0-9_-]{16,60}$/.test(param.trim())
}

export function isDevicesStartParam(param: string): boolean {
  const trimmed = param.trim()
  return trimmed === 'devices' || trimmed.startsWith('devices')
}

/**
 * Where a launch startapp should send the user once.
 * Returns null when already on the target screen or param is unrelated.
 */
export function resolveTelegramStartRedirectPath(
  param: string,
  hash: string
): '/link-web' | '/devices' | null {
  const trimmed = param.trim()
  if (!trimmed) return null

  if (isWebLinkStartParam(trimmed)) {
    if (hash.includes('/link-web')) return null
    return '/link-web'
  }

  if (isDevicesStartParam(trimmed)) {
    if (hash.includes('/devices') || hash.includes('/link-web')) return null
    return '/devices'
  }

  return null
}