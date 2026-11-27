/**
 * Confirmed Telegram Mini App production API (Timeweb).
 * Do not switch hosts here without an explicit release decision.
 */
export const MINIAPP_PROD_API_ORIGIN = 'https://dantilor-telegram-card-game-3706.twc1.net'
export const MINIAPP_BLOCKED_RENDER_HOST = 'telegram-card-game.onrender.com'
export const MINIAPP_WEB_PROMO_URL = 'https://play.gamenighthost.ru/'
export const MINIAPP_PROD_BASE = '/'

export function normalizeApiOrigin(value) {
  return String(value ?? '').trim().replace(/\/$/, '')
}
