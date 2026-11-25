/**
 * Normalize SPA paths for Metrika hits — no tokens, emails, or private query values.
 */

const SENSITIVE_PREFIXES = [
  '/email/confirm',
  '/link-web',
  '/recover',
  '/login',
] as const

const GAME_OPEN_PREFIXES = [
  '/mafia',
  '/mafia-shadows',
  '/alias',
  '/activity',
  '/quiz',
  '/sabotage',
  '/truth-dare',
  '/who-is-who',
  '/phrase-translator',
  '/freebie-trash',
  '/russia-travel',
  '/sled',
  '/doubles',
  '/infected',
  '/play',
  '/card',
  '/game',
  '/decks',
  '/mode',
] as const

/** Collapse dynamic segments that may hold user content. */
function scrubSegments(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean)
  if (parts[0] === 'decks' && parts[1] === 'custom') return '/decks/custom'
  if (parts[0] === 'discover' && parts[1]) {
    const slug = parts[1]
    if (/^[a-z0-9-]{1,80}$/.test(slug)) return `/discover/${slug}`
    return '/discover'
  }
  if (parts[0] === 'legal') return '/legal'
  // Keep first two segments for known app trees; drop deeper ids.
  if (GAME_OPEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    if (parts.length <= 2) return `/${parts.join('/')}`
    return `/${parts.slice(0, 2).join('/')}`
  }
  if (parts.length > 3) return `/${parts.slice(0, 2).join('/')}`
  return pathname || '/'
}

export function normalizeMetrikaPath(pathname: string, search = ''): string {
  let path = pathname.trim() || '/'
  if (!path.startsWith('/')) path = `/${path}`
  // Strip hash routers accidentally mixed in.
  path = path.replace(/#.*$/, '')
  path = path.replace(/\/{2,}/g, '/')
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1)

  for (const prefix of SENSITIVE_PREFIXES) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return prefix
  }

  path = scrubSegments(path)

  // Never forward query string — tokens live there (email confirm, payment return, etc.).
  void search
  return path || '/'
}

export function metrikaAbsoluteUrl(pathname: string): string {
  const path = normalizeMetrikaPath(pathname)
  try {
    return new URL(path, window.location.origin).href
  } catch {
    return path
  }
}

export function isGameOpenPath(pathname: string): boolean {
  const path = normalizeMetrikaPath(pathname)
  return GAME_OPEN_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
}

export function gameIdFromPath(pathname: string): string | undefined {
  const path = normalizeMetrikaPath(pathname)
  const first = path.split('/').filter(Boolean)[0]
  if (!first) return undefined
  if (first === 'play' || first === 'card' || first === 'decks' || first === 'mode') {
    return 'card'
  }
  if (first === 'comics' || first === 'game') return first
  return first
}