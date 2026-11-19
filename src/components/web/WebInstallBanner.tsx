import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { isWebShell } from '../../config/shell'
import { haptic } from '../../utils/telegram'
import {
  type BeforeInstallPromptEventLike,
  dismissInstallPrompt,
  hasInstallEngaged,
  isDismissedRecently,
  isGameplayPath,
  isIosSafariLike,
  isStandaloneDisplay,
  isTelegramWebView,
  markInstallEngaged,
  registerWebServiceWorker,
} from '../../lib/webInstall'
import './WebInstallBanner.css'

type Mode = 'hidden' | 'native' | 'guide'

export default function WebInstallBanner() {
  const location = useLocation()
  const [deferred, setDeferred] = useState<BeforeInstallPromptEventLike | null>(null)
  const [mode, setMode] = useState<Mode>('hidden')
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(() => hasInstallEngaged())
  const [force, setForce] = useState(false)

  useEffect(() => {
    if (!isWebShell()) return
    void registerWebServiceWorker()
  }, [])

  useEffect(() => {
    if (!isWebShell()) return
    if (isStandaloneDisplay() || isTelegramWebView() || isDismissedRecently()) return

    const onBip = (ev: Event) => {
      ev.preventDefault()
      setDeferred(ev as BeforeInstallPromptEventLike)
    }
    const onInstalled = () => {
      setDeferred(null)
      setMode('hidden')
      setForce(false)
    }
    window.addEventListener('beforeinstallprompt', onBip)
    window.addEventListener('appinstalled', onInstalled)
    const t = window.setTimeout(() => {
      markInstallEngaged()
      setReady(true)
    }, 10_000)
    const open = () => {
      setReady(true)
      setForce(true)
    }
    window.addEventListener('gnh:open-install', open)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBip)
      window.removeEventListener('appinstalled', onInstalled)
      window.removeEventListener('gnh:open-install', open)
      window.clearTimeout(t)
    }
  }, [])

  useEffect(() => {
    if (!isWebShell() || isStandaloneDisplay() || isTelegramWebView() || isDismissedRecently()) {
      setMode('hidden')
      return
    }
    if (!ready && !force) {
      setMode('hidden')
      return
    }
    if (isGameplayPath(location.pathname) && !force) {
      setMode('hidden')
      return
    }
    setMode(deferred ? 'native' : 'guide')
  }, [deferred, ready, force, location.pathname])

  const onLater = useCallback(() => {
    haptic('light')
    dismissInstallPrompt()
    setMode('hidden')
    setForce(false)
  }, [])

  const onAdd = useCallback(async () => {
    haptic('medium')
    if (!deferred) return
    setBusy(true)
    try {
      await deferred.prompt()
      await deferred.userChoice
      setDeferred(null)
      setMode('hidden')
      setForce(false)
    } catch {
      /* keep guide visible */
    } finally {
      setBusy(false)
    }
  }, [deferred])

  if (!isWebShell() || mode === 'hidden') return null

  const guideText = isIosSafariLike()
    ? 'На iPhone откройте меню «Поделиться» и выберите «На экран «Домой»».'
    : 'В меню браузера выберите «Установить приложение» или «Добавить на главный экран».'

  return (
    <aside className="web-install-banner" role="dialog" aria-label="Установка GameNight Host">
      <div className="web-install-banner__card">
        <div className="web-install-banner__copy">
          <p className="web-install-banner__title">GameNight Host — всегда под рукой</p>
          <p className="web-install-banner__text">
            {mode === 'native'
              ? 'Добавьте игры на главный экран и запускайте их как приложение.'
              : guideText}
          </p>
        </div>
        <div className="web-install-banner__actions">
          {mode === 'native' ? (
            <button
              type="button"
              className="web-install-banner__btn web-install-banner__btn--primary"
              onClick={() => void onAdd()}
              disabled={busy}
            >
              {busy ? '…' : 'Добавить'}
            </button>
          ) : null}
          <button type="button" className="web-install-banner__btn web-install-banner__btn--ghost" onClick={onLater}>
            Позже
          </button>
        </div>
      </div>
    </aside>
  )
}

export function openWebInstallPrompt(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('gnh:open-install'))
}
