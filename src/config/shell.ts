/**
 * App shell: Telegram Mini App vs standalone WEB browser.
 * Controlled by Vite `--mode web`, `.env.web`, and build-time `__GNH_SHELL__`.
 */

export type AppShell = 'telegram' | 'web'

declare const __GNH_SHELL__: string | undefined

export function getAppShell(): AppShell {
  try {
    if (typeof __GNH_SHELL__ === 'string' && __GNH_SHELL__.toLowerCase() === 'web') return 'web'
  } catch {
    /* define may be absent in unit tests */
  }
  const raw = String(import.meta.env.VITE_GNH_SHELL ?? '')
    .trim()
    .toLowerCase()
  if (raw === 'web') return 'web'
  if (String(import.meta.env.MODE ?? '').toLowerCase() === 'web') return 'web'
  return 'telegram'
}

export function isWebShell(): boolean {
  return getAppShell() === 'web'
}

export function isTelegramShell(): boolean {
  return getAppShell() === 'telegram'
}
