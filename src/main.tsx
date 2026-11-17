import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { parseAndCacheFromHash } from './utils/telegramInitCache'
import { initTheme, type ThemeId } from './hooks/useTheme'
import { initTelegramUI, applyTelegramColorsRetry } from './lib/telegramTheme'
import { publishLoadTimingReport } from './lib/loadTiming'
import '@fontsource/manrope/400.css'
import '@fontsource/manrope/500.css'
import '@fontsource/manrope/600.css'
import '@fontsource/manrope/700.css'
import '@fontsource/unbounded/500.css'
import '@fontsource/unbounded/600.css'
import '@fontsource/unbounded/700.css'
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

try {
  initTelegramUI()
  applyTelegramColorsRetry(theme)
} catch {
  // no-op: вне Telegram / браузер
}

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
