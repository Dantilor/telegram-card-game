import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { parseAndCacheFromHash } from './utils/telegramInitCache'
import { initTheme, type ThemeId } from './hooks/useTheme'
import { initTelegramUI, applyTelegramColorsRetry } from './lib/telegramTheme'
import { ensureTelegramSdkLoaded, subscribeTelegramSdkReady } from './lib/telegramSdk'
import { publishLoadTimingReport } from './lib/loadTiming'
import { installChunkRecovery } from './lib/chunkRecovery'
// Only latin + cyrillic subsets — avoid greek/vietnamese download on cold start.
import '@fontsource/manrope/latin-400.css'
import '@fontsource/manrope/latin-500.css'
import '@fontsource/manrope/latin-600.css'
import '@fontsource/manrope/latin-700.css'
import '@fontsource/manrope/cyrillic-400.css'
import '@fontsource/manrope/cyrillic-500.css'
import '@fontsource/manrope/cyrillic-600.css'
import '@fontsource/manrope/cyrillic-700.css'
import '@fontsource/unbounded/latin-500.css'
import '@fontsource/unbounded/latin-600.css'
import '@fontsource/unbounded/latin-700.css'
import '@fontsource/unbounded/cyrillic-500.css'
import '@fontsource/unbounded/cyrillic-600.css'
import '@fontsource/unbounded/cyrillic-700.css'
import './index.css'
import './styles/tg.css'
import App from './App.tsx'

let theme: ThemeId
try {
  theme = initTheme()
} catch {
  theme = 'neon-light'
}

parseAndCacheFromHash()

// Install before React and lazy routes, so old game chunks do not blank the app.
installChunkRecovery()

// Kick SDK download immediately without blocking module evaluation on telegram.org.
ensureTelegramSdkLoaded().catch(() => undefined)

function applyTelegramWhenReady(): void {
  try {
    initTelegramUI()
    applyTelegramColorsRetry(theme)
  } catch {
    // no-op: вне Telegram / браузер
  }
}

applyTelegramWhenReady()
subscribeTelegramSdkReady(applyTelegramWhenReady)

const rootEl = document.getElementById('root')!
createRoot(rootEl).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)

// Opt-in VPN/cold-start report: ?gnh_perf=1 or localStorage.gnh_perf=1 → window.__GNH_PERF__
publishLoadTimingReport()
