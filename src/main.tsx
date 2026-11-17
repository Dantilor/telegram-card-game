import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { normalizeHash, parseAndCacheFromHash } from './utils/telegramInitCache'
import { initTheme, type ThemeId } from './hooks/useTheme'
import { initTelegramUI, applyTelegramColorsRetry } from './lib/telegramTheme'
import { ensureTelegramSdkLoaded, isTelegramSdkReady, whenTelegramSdkReady, subscribeTelegramSdkReady } from './lib/telegramSdk'
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

// Capture Telegram launch parameters in the SDK before HashRouter normalizes
// #tgWebAppData=... to #/. The deferred same-origin script in index.html
// normally finishes before the Vite module executes.
let theme: ThemeId
try {
  theme = initTheme()
} catch {
  theme = 'neon-light'
}

// Install before React and lazy routes, so old chunks do not blank the app.
installChunkRecovery()

function applyTelegramWhenReady(): void {
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
  // Preserve Telegram's launch parameters before starting the async SDK.
  // If the SDK has already executed but storage was unavailable, it is now
  // safe to normalize the original hash for HashRouter.
  const captured = parseAndCacheFromHash()
  if (!captured && isTelegramSdkReady()) normalizeHash()
  ensureTelegramSdkLoaded().catch(() => undefined)

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

  // Opt-in VPN/cold-start report. Does not include Telegram identity.
  publishLoadTimingReport()
}

// The local SDK is fetched asynchronously instead of blocking module execution.
// Seed the SDK's own sessionStorage launch cache before HashRouter rewrites #.
// For storage-restricted WebViews, retain the previous safe wait as a fallback.
const hasTelegramLaunchHash = typeof window !== 'undefined' && window.location.hash.includes('tgWebAppData=')
const launchCaptured = !hasTelegramLaunchHash || isTelegramSdkReady() || Boolean(parseAndCacheFromHash())
if (launchCaptured) {
  mountApp()
} else {
  void whenTelegramSdkReady(3500).then(mountApp, mountApp)
}
