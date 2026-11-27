import { useCallback, useState } from 'react'
import { getTelegramWebApp } from '../lib/telegram'
import { haptic } from '../utils/telegram'
import './HomeWebPromoCard.css'

export const WEB_PROMO_URL = 'https://play.gamenighthost.ru/'
export const WEB_PROMO_DISMISS_KEY = 'gnh_miniapp_web_promo_dismissed_v1'

function isWebShellBuild(): boolean {
  return import.meta.env.VITE_GNH_SHELL === 'web'
}

export function isWebPromoDismissed(): boolean {
  try {
    return localStorage.getItem(WEB_PROMO_DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

export function dismissWebPromo(): void {
  try {
    localStorage.setItem(WEB_PROMO_DISMISS_KEY, '1')
  } catch {
    /* private mode — hide in memory only */
  }
}

/** Open the public WEB site without replacing the Mini App. */
export function openWebPromoLink(url: string = WEB_PROMO_URL): void {
  const tg = getTelegramWebApp()
  if (tg?.openLink) {
    tg.openLink(url)
    return
  }
  try {
    const opened = window.open(url, '_blank', 'noopener,noreferrer')
    if (opened) return
  } catch {
    /* fall through */
  }
  window.location.assign(url)
}

/**
 * Compact Mini App-only promo for the public WEB site.
 * Hidden in WEB builds and after the visitor dismisses it locally.
 */
export default function HomeWebPromoCard() {
  const [visible, setVisible] = useState(() => !isWebShellBuild() && !isWebPromoDismissed())

  const onOpen = useCallback(() => {
    haptic('light')
    openWebPromoLink()
  }, [])

  const onDismiss = useCallback(() => {
    haptic('light')
    dismissWebPromo()
    setVisible(false)
  }, [])

  if (isWebShellBuild() || !visible) return null

  return (
    <section className="home-web-promo" aria-label="GameNight Host в браузере">
      <div className="home-web-promo__card">
        <button
          type="button"
          className="home-web-promo__close"
          aria-label="Скрыть"
          onClick={onDismiss}
        >
          <span aria-hidden>×</span>
        </button>
        <div className="home-web-promo__glow" aria-hidden />
        <div className="home-web-promo__body">
          <p className="home-web-promo__eyebrow">Новое</p>
          <h2 className="home-web-promo__title">🌐 GameNight Host теперь и в браузере!</h2>
          <p className="home-web-promo__text">Любимые игры теперь доступны на нашем сайте. Открывай с телефона или компьютера!</p>
          <button type="button" className="home-web-promo__cta" onClick={onOpen}>
            Открыть сайт
          </button>
        </div>
      </div>
    </section>
  )
}