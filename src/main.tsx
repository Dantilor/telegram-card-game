import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import { normalizeHash, parseAndCacheFromHash } from './utils/telegramInitCache'
import { initTheme, type ThemeId } from './hooks/useTheme'
import { initTelegramUI, applyTelegramColorsRetry } from './lib/telegramTheme'
import { ensureTelegramSdkLoaded, isTelegramSdkReady, whenTelegramSdkReady, subscribeTelegramSdkReady } from './lib/telegramSdk'
import { publishLoadTimingReport } from './lib/loadTiming'
import { installChunkRecovery } from './lib/chunkRecovery'
import { scheduleWhenIdle } from './utils/scheduleWhenIdle'
import { isWebShell } from './config/shell'
// Critical path fonts only (latin + cyrillic). Extra weights load after idle.
import '@fontsource/manrope/latin-400.css'
import '@fontsource/manrope/latin-600.css'
import '@fontsource/manrope/latin-700.css'
import '@fontsource/manrope/cyrillic-400.css'
import '@fontsource/manrope/cyrillic-600.css'
import '@fontsource/manrope/cyrillic-700.css'
import '@fontsource/unbounded/latin-700.css'
import '@fontsource/unbounded/cyrillic-700.css'
import './index.css'
import './styles/tg.css'
import App from './App.tsx'

function loadDeferredFonts(): void {
  void Promise.all([
    import('@fontsource/manrope/latin-500.css'),
    import('@fontsource/manrope/cyrillic-500.css'),
    import('@fontsource/unbounded/latin-500.css'),
    import('@fontsource/unbounded/latin-600.css'),
    import('@fontsource/unbounded/cyrillic-500.css'),
    import('@fontsource/unbounded/cyrillic-600.css'),
  ]).catch(() => undefined)
}

let theme: ThemeId
try {
  theme = initTheme()
} catch {
  theme = 'neon-light'
}

const web = isWebShell()
document.documentElement.dataset.gnhShell = web ? 'web' : 'telegram'

installChunkRecovery()

function applyTelegramWhenReady(): void {
  if (web) return
  try {
    initTelegramUI()
    applyTelegramColorsRetry(theme)
  } catch {
    // Outside Telegram / unsupported WebView.
  }
}

let mounted = false
function mountApp(): void {
  if (mounted) return
  mounted = true

  if (!web) {
    const captured = parseAndCacheFromHash()
    if (!captured && isTelegramSdkReady()) normalizeHash()
    ensureTelegramSdkLoaded().catch(() => undefined)
    applyTelegramWhenReady()
    subscribeTelegramSdkReady(applyTelegramWhenReady)
  }

  const Router = web ? BrowserRouter : HashRouter
  const rootEl = document.getElementById('root')!
  createRoot(rootEl).render(
    <StrictMode>
      <Router>
        <App />
      </Router>
    </StrictMode>,
  )

  if (!web) {
    publishLoadTimingReport()
  }
  scheduleWhenIdle(loadDeferredFonts, web ? 1200 : 3500)
}

if (web) {
  mountApp()
} else {
  const hasTelegramLaunchHash = typeof window !== 'undefined' && window.location.hash.includes('tgWebAppData=')
  const launchCaptured = !hasTelegramLaunchHash || isTelegramSdkReady() || Boolean(parseAndCacheFromHash())
  if (launchCaptured) {
    mountApp()
  } else {
    void whenTelegramSdkReady(3500).then(mountApp, mountApp)
  }
}