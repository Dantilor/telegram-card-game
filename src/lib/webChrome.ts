/** WEB shell chrome helpers — hide nav / immersive paths. Mini App untouched. */

export function isImmersiveWebPath(pathname: string): boolean {
  const p = pathname || '/'
  if (p === '/premium' || p === '/wheel') return true
  if (p.startsWith('/play/')) return true
  if (p.startsWith('/comics/') && p !== '/comics' && p !== '/comics/') return true
  if (p === '/login' || p === '/recover' || p.startsWith('/email/')) return true
  if (/^\/russia-travel(\/|$)/.test(p)) return true
  if (
    /^\/(alias|activity|mafia|sabotage|quiz|truth-dare|sled|mafia-shadows|doubles|infected|who-is-who|phrase-translator|freebie-trash|card)(\/|$)/.test(
      p
    )
  ) {
    return true
  }
  if (/^\/mode\//.test(p)) return true
  if (/^\/deck\//.test(p) || /^\/game\//.test(p)) return true
  return false
}

export function getWebScrollRoot(): HTMLElement | null {
  if (typeof document === 'undefined') return null
  return (
    (document.querySelector('.app.app--web > .gnh-inside') as HTMLElement | null) ||
    (document.querySelector('.app.app--web .gnh-home-scroll') as HTMLElement | null) ||
    (document.querySelector('.app.app--web') as HTMLElement | null)
  )
}

export function scrollWebShellToTop(behavior: ScrollBehavior = 'auto'): void {
  const root = getWebScrollRoot()
  if (root) {
    root.scrollTo({ top: 0, left: 0, behavior })
    return
  }
  window.scrollTo({ top: 0, left: 0, behavior })
}