import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { isWebMetrikaFeatureEnabled } from '../../analytics/metrikaFeature'
import {
  getMetrikaConsent,
  setMetrikaConsent,
  subscribeMetrikaConsent,
  type MetrikaConsentState,
} from '../../analytics/metrikaConsent'
import { disableYandexMetrika, enableYandexMetrika, hitYandexMetrika } from '../../analytics/yandexMetrika'
import { normalizeMetrikaPath } from '../../analytics/metrikaPath'
import { useLegal } from '../../legal/LegalProvider'
import { haptic } from '../../utils/telegram'
import './WebMetrikaConsentBanner.css'

/**
 * Soft, non-blocking banner: discloses Yandex Metrika before any tag.js load.
 * Refusal keeps the site fully usable. Choice is revocable in Profile.
 */
export default function WebMetrikaConsentBanner() {
  const legal = useLegal()
  const location = useLocation()
  const [consent, setConsent] = useState<MetrikaConsentState>(() =>
    isWebMetrikaFeatureEnabled() ? getMetrikaConsent() : 'denied'
  )
  const [visible, setVisible] = useState(false)
  // The first-use sheet records "Later" in sessionStorage without any event; poll while it is open.
  const [sheetTick, setSheetTick] = useState(0)

  useEffect(() => {
    if (!isWebMetrikaFeatureEnabled()) return
    return subscribeMetrikaConsent((state) => setConsent(state))
  }, [])

  useEffect(() => {
    if (!isWebMetrikaFeatureEnabled()) return
    if (consent !== 'unknown') {
      setVisible(false)
      return
    }
    // Wait while the first-use agreement dialog is on screen; never block games after it is dismissed.
    if (legal.status === 'loading') return
    let sheetClosed = false
    try {
      sheetClosed = sessionStorage.getItem('gnh_legal_sheet_closed') === '1'
    } catch {
      sheetClosed = false
    }
    const agreementBlocking =
      legal.status === 'ready' && legal.records?.agreement?.active !== true && !sheetClosed
    if (agreementBlocking) {
      const poll = window.setInterval(() => {
        try {
          if (sessionStorage.getItem('gnh_legal_sheet_closed') === '1') setSheetTick((n) => n + 1)
        } catch {
          /* ignore */
        }
      }, 500)
      return () => window.clearInterval(poll)
    }
    const t = window.setTimeout(() => setVisible(true), 600)
    return () => window.clearTimeout(t)
  }, [consent, legal.status, legal.records?.agreement?.active, location.pathname, sheetTick])

  const accept = useCallback(() => {
    haptic('light')
    setMetrikaConsent('granted')
    setConsent('granted')
    setVisible(false)
    void (async () => {
      await enableYandexMetrika()
      hitYandexMetrika(normalizeMetrikaPath(location.pathname), document.title)
    })()
  }, [location.pathname])

  const decline = useCallback(() => {
    haptic('light')
    setMetrikaConsent('denied')
    setConsent('denied')
    setVisible(false)
    disableYandexMetrika({ reload: true })
  }, [])

  if (!isWebMetrikaFeatureEnabled() || !visible || consent !== 'unknown') return null

  return (
    <div className="web-metrika-banner" role="dialog" aria-label="Согласие на аналитику">
      <div className="web-metrika-banner__card">
        <p className="web-metrika-banner__title">Аналитика сайта</p>
        <p className="web-metrika-banner__text">
          Чтобы понимать, как пользуются сайтом, мы можем подключить Яндекс Метрику (счётчик 114652319).
          Загружаются cookie Яндекса. Вебвизор, карта кликов и слежение за ссылками выключены. Отказ не мешает
          играть и покупать Premium. Подробности — в{' '}
          <button
            type="button"
            className="web-metrika-banner__link"
            onClick={() => {
              haptic('light')
              legal.openDocument('privacy')
            }}
          >
            политике конфиденциальности
          </button>
          . Выбор можно изменить в профиле: отзыв останавливает новую отправку, но не удаляет уже переданные Яндексу
          данные.
        </p>
        <div className="web-metrika-banner__actions">
          <button type="button" className="web-metrika-banner__btn web-metrika-banner__btn--primary" onClick={accept}>
            Разрешить Метрику
          </button>
          <button type="button" className="web-metrika-banner__btn web-metrika-banner__btn--quiet" onClick={decline}>
            Отказаться
          </button>
        </div>
      </div>
    </div>
  )
}