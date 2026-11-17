import { getInitData } from './telegram'
import { ensureTelegramSdkLoaded, isTelegramSdkReady, TELEGRAM_SDK_READY_EVENT } from './telegramSdk'

/**
 * Telegram WebApp script may finish after first paint on slow links.
 * Wait for SDK + initData without blocking the Home shell forever.
 */
export async function waitForInitData(timeoutMs = 2500, intervalMs = 50): Promise<string> {
  const existing = getInitData()
  if (existing) return existing

  ensureTelegramSdkLoaded().catch(() => undefined)

  return new Promise((resolve) => {
    let settled = false
    const finish = (value: string) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(value)
    }

    const tick = () => {
      const value = getInitData()
      if (value) finish(value)
    }

    const onReady = () => tick()
    const interval = window.setInterval(tick, intervalMs)
    const timer = window.setTimeout(() => finish(getInitData()), timeoutMs)

    const cleanup = () => {
      window.clearInterval(interval)
      window.clearTimeout(timer)
      window.removeEventListener(TELEGRAM_SDK_READY_EVENT, onReady)
    }

    window.addEventListener(TELEGRAM_SDK_READY_EVENT, onReady)
    if (isTelegramSdkReady()) tick()
  })
}
