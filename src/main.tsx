import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { initTheme } from './hooks/useTheme'
import './index.css'
import './styles/tg.css'
import App from './App.tsx'

function isDebug(): boolean {
  if (typeof window === 'undefined') return false
  const search =
    window.location.search ||
    (window.location.hash.includes('?') ? '?' + window.location.hash.split('?')[1] : '')
  return new URLSearchParams(search).get('debug') === '1'
}

function setBootDebug(text: string): void {
  if (typeof document === 'undefined') return
  const el = document.getElementById('boot-debug')
  if (el && el.style.display !== 'none') el.textContent = text
}

const boot = document.getElementById('html-boot')
if (boot) boot.textContent = 'JS STARTED'

if (isDebug()) setBootDebug('MAIN START')

try {
  initTheme()
} catch {
  // no-op: don't block render
}

const rootEl = document.getElementById('root')!
if (boot) boot.textContent = 'REACT RENDER CALLED'
createRoot(rootEl).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)

if (isDebug()) setBootDebug('APP RENDER CALLED')

if (isDebug()) {
  setTimeout(() => {
    if (rootEl && rootEl.childNodes.length === 0) {
      setBootDebug((document.getElementById('boot-debug')?.textContent || '') + '\nROOT EMPTY AFTER 2s')
    }
  }, 2000)
}
