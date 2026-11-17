import { getInitData } from './telegram'

/**
 * Telegram WebApp script may finish a moment after first paint on slow links.
 * Poll briefly so Premium/legal can attach without blocking the Home shell.
 */
export async function waitForInitData(timeoutMs = 2000, intervalMs = 100): Promise<string> {
  const existing = getInitData()
  if (existing) return existing
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
    const value = getInitData()
    if (value) return value
  }
  return getInitData()
}
