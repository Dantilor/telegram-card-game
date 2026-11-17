/**
 * Recover from a stale Vite bundle when GitHub Pages is deployed while a
 * Telegram WebView still holds the previous index.html. A missing hashed
 * dynamic import must never leave the player on an empty screen.
 *
 * Safety: one automatic reload per 90s, preserve Telegram hash/start params,
 * do not send initData anywhere and never retry payment requests.
 */
const RELOAD_PARAM = '_gnh_bundle_refresh'
const RELOAD_KEY = 'gnh_bundle_reloaded_at'
const MIN_RELOAD_INTERVAL_MS = 90_000

export function isChunkLoadError(reason: unknown): boolean {
  const text = reason instanceof Error ? reason.message : String(reason ?? '')
  return /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk [^\n]* failed|Unable to preload CSS|error loading dynamically imported module/i.test(text)
}

export function shouldReloadForChunkError(
  now: number,
  previousStorageTime: number | null,
  previousUrlTime: number | null,
): boolean {
  const previous = Math.max(previousStorageTime ?? 0, previousUrlTime ?? 0)
  return !(previous > 0 && now - previous < MIN_RELOAD_INTERVAL_MS)
}

export function recoverMissingGameChunk(): boolean {
  if (typeof window === 'undefined') return false
  const now = Date.now()
  const url = new URL(window.location.href)
  let previousStorageTime: number | null = null
  try {
    previousStorageTime = Number(window.sessionStorage.getItem(RELOAD_KEY)) || null
  } catch {
    // Private WebViews may deny storage. URL guard still prevents a reload loop.
  }
  const previousUrlTime = Number(url.searchParams.get(RELOAD_PARAM)) || null
  if (!shouldReloadForChunkError(now, previousStorageTime, previousUrlTime)) return false
  try {
    window.sessionStorage.setItem(RELOAD_KEY, String(now))
  } catch {
    // The query parameter is a second guard when storage is unavailable.
  }
  url.searchParams.set(RELOAD_PARAM, String(now))
  // A different document URL bypasses a stale cached index.html, while the
  // hash (including any Telegram launch data) is preserved unchanged.
  window.location.replace(url.toString())
  return true
}

export function showChunkRecoveryNotice(): void {
  if (typeof document === 'undefined' || document.getElementById('gnh-chunk-recovery')) return
  const notice = document.createElement('div')
  notice.id = 'gnh-chunk-recovery'
  notice.setAttribute('role', 'alert')
  notice.style.cssText =
    'position:fixed;z-index:2147483647;inset:auto 12px 20px;padding:20px;box-sizing:border-box;' +
    'border-radius:16px;background:#171427;color:#fff;text-align:center;box-shadow:0 4px 20px #0006;' +
    'font:16px/1.4 system-ui,sans-serif'
  const message = document.createElement('p')
  message.textContent = 'Приложение обновилось. Закройте игру и откройте её снова через Telegram.'
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = 'Обновить приложение'
  button.style.cssText = 'padding:12px 20px;border:0;border-radius:10px;background:#a695ff;color:#12101a;font-weight:700'
  button.addEventListener('click', () => {
    window.location.reload()
  })
  notice.append(message, button)
  document.body.appendChild(notice)
}

export function installChunkRecovery(): void {
  if (typeof window === 'undefined') return
  window.addEventListener('vite:preloadError', (event: Event) => {
    event.preventDefault()
    if (!recoverMissingGameChunk()) showChunkRecoveryNotice()
  })
}
