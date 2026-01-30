;(function () {
  try {
    ;(window as any).__APP_MOUNTED__ = true
    console.log('MAIN STARTED')
  } catch {
    // no-op
  }
})()

;(function setupDebugCapture() {
  if (typeof window === 'undefined') return
  const win = window as any
  win.__DEBUG_LOGS__ = win.__DEBUG_LOGS__ ?? []
  win.__DEBUG_ERRORS__ = win.__DEBUG_ERRORS__ ?? []
  const pushLog = (type: 'log' | 'error', args: unknown[]) => {
    win.__DEBUG_LOGS__.push({ type, args: [...args], ts: Date.now() })
    window.dispatchEvent(new CustomEvent('tgg-debug-log'))
  }
  const pushError = (message: string, stack?: string) => {
    win.__DEBUG_ERRORS__.push({ message, stack, ts: Date.now() })
    window.dispatchEvent(new CustomEvent('tgg-debug-error'))
  }
  const origLog = console.log
  const origError = console.error
  console.log = (...args: unknown[]) => {
    pushLog('log', args)
    origLog.apply(console, args)
  }
  console.error = (...args: unknown[]) => {
    pushLog('error', args)
    origError.apply(console, args)
  }
  window.onerror = (message, _source, _lineno, _colno, error) => {
    pushError(String(message), error?.stack)
  }
  window.addEventListener('unhandledrejection', (e) => {
    pushError(String(e.reason?.message ?? e.reason), e.reason?.stack)
  })
})()

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { initTheme } from './hooks/useTheme'
import './index.css'
import './styles/tg.css'
import App from './App.tsx'
import DebugOverlay from './components/DebugOverlay'

try {
  initTheme()
} catch {
  // no-op: don't block render
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
    <DebugOverlay />
  </StrictMode>,
)
