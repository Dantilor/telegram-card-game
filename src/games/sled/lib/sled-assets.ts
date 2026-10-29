/** Public asset URLs for SLED under Vite base + /games/sled/ */

function appBase() {
  const base = typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL
    ? String(import.meta.env.BASE_URL)
    : '/'
  return base.endsWith('/') ? base.slice(0, -1) : base
}

export function sledBasePath() {
  return `${appBase()}/games/sled`
}

/** Map standalone paths `/evidence/...` and `/game/...` to GNH public URLs. */
export function sledAsset(src: string) {
  if (!src) return src
  if (/^https?:\/\//i.test(src) || src.startsWith('data:')) return src
  const clean = src.startsWith('/') ? src : `/${src}`
  if (clean.startsWith('/games/sled/')) {
    return `${appBase()}${clean}`
  }
  if (clean.startsWith('/evidence/') || clean.startsWith('/game/')) {
    return `${sledBasePath()}${clean}`
  }
  return `${sledBasePath()}${clean}`
}
