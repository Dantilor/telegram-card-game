/**
 * Legal pages URLs and open helper.
 */

import { getTelegramWebApp } from './telegram'

export const LEGAL_PATHS = {
  privacy: '/legal/privacy',
  terms: '/legal/terms',
  premium: '/legal/premium',
} as const

export function getLegalUrl(path: keyof typeof LEGAL_PATHS): string {
  const base = typeof window !== 'undefined' ? window.location.href.split('#')[0] : ''
  return base + '#' + LEGAL_PATHS[path]
}

export function openLegalLink(path: keyof typeof LEGAL_PATHS): void {
  const url = getLegalUrl(path)
  const tg = getTelegramWebApp()
  if (tg?.openLink) {
    tg.openLink(url)
  } else {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}
