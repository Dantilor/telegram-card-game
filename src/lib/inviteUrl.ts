import { isWebShell } from '../config/shell'

/**
 * Party invite URLs:
 * - Mini App (HashRouter): origin + pathname + #/game?room=CODE
 * - WEB (BrowserRouter): origin + /game?room=CODE
 * Never embeds host tokens.
 */
export function buildPartyInviteUrl(gamePath: string, roomCode: string): string {
  const path = gamePath.startsWith('/') ? gamePath : `/${gamePath}`
  const code = encodeURIComponent(roomCode)
  if (typeof window === 'undefined') {
    return `${path}?room=${code}`
  }
  if (isWebShell()) {
    return `${window.location.origin}${path}?room=${code}`
  }
  return `${window.location.origin}${window.location.pathname}#${path}?room=${code}`
}

/** Read room code from WEB search or Mini App hash query. */
export function readRoomCodeFromLocation(search?: string, hash?: string): string {
  const fromSearch = new URLSearchParams(
    search ?? (typeof window !== 'undefined' ? window.location.search : '')
  ).get('room')
  if (fromSearch && /^\d{4,8}$/.test(fromSearch)) return fromSearch

  const rawHash = hash ?? (typeof window !== 'undefined' ? window.location.hash : '')
  const qIndex = rawHash.indexOf('?')
  if (qIndex >= 0) {
    const fromHash = new URLSearchParams(rawHash.slice(qIndex + 1)).get('room')
    if (fromHash && /^\d{4,8}$/.test(fromHash)) return fromHash
  }
  return ''
}
