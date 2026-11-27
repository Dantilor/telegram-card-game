import { useCallback } from 'react'
import { haptic } from '../utils/telegram'
import { openWebPromoLink, WEB_PROMO_URL } from './HomeWebPromoCard'
import './HomeWebSiteLink.css'

function isWebShellBuild(): boolean {
  return import.meta.env.VITE_GNH_SHELL === 'web'
}

/**
 * Permanent Mini App-only secondary link under the Hero «Начать игру» CTA.
 * Independent of HomeWebPromoCard dismiss state — never uses localStorage.
 */
export default function HomeWebSiteLink() {
  const onOpen = useCallback(() => {
    haptic('light')
    openWebPromoLink(WEB_PROMO_URL)
  }, [])

  if (isWebShellBuild()) return null

  return (
    <button
      type="button"
      className="home-web-site-link"
      onClick={onOpen}
      aria-label="Играть на сайте"
    >
      <span className="home-web-site-link__icon" aria-hidden>
        🌐
      </span>
      <span className="home-web-site-link__label">Играть на сайте</span>
      <span className="home-web-site-link__arrow" aria-hidden>
        ↗
      </span>
    </button>
  )
}
