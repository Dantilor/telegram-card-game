/** Build Telegram Mini App deep links for WEB↔Telegram Premium linking. */

export function telegramBotUsername(): string {
  return (
    process.env.TELEGRAM_BOT_USERNAME ||
    process.env.BOT_USERNAME ||
    'GameNightHostBot'
  )
    .trim()
    .replace(/^@/, '')
}

/**
 * Optional Direct Link short name from BotFather (t.me/bot/shortname).
 * When empty, uses Main Mini App form: t.me/bot?startapp=…
 */
export function telegramMiniAppShortName(): string {
  return (process.env.TELEGRAM_MINI_APP_SHORT_NAME || process.env.TELEGRAM_WEBAPP_SHORT_NAME || '')
    .trim()
    .replace(/^\//, '')
}

/** startapp payload: wl_ + url-safe token. Telegram allows [A-Za-z0-9_-], max 64. */
export const TG_LINK_START_PREFIX = 'wl_'

export function isTelegramLinkStartParam(value: string): boolean {
  return /^wl_[A-Za-z0-9_-]{16,60}$/.test(value.trim())
}

export function buildTelegramLinkDeepLink(startParam: string): string {
  const bot = telegramBotUsername()
  const shortName = telegramMiniAppShortName()
  const param = encodeURIComponent(startParam)
  if (shortName) {
    return `https://t.me/${bot}/${shortName}?startapp=${param}`
  }
  return `https://t.me/${bot}?startapp=${param}`
}