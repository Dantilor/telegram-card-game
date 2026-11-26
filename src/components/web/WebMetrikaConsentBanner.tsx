import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { isWebMetrikaFeatureEnabled } from '../../analytics/metrikaFeature'
import {
  getMetrikaConsent,
  isMetrikaPostponed,
  postponeMetrikaConsent,
  setMetrikaConsent,
  subscribeMetrikaConsent,
  type MetrikaConsentState,
} from '../../analytics/metrikaConsent'
import { disableYandexMetrika, enableYandexMetrika, hitYandexMetrika } from '../../analytics/yandexMetrika'
import { persistMetrikaConsentEvidence } from '../../analytics/persistMetrikaConsent'
import { normalizeMetrikaPath } from '../../analytics/metrikaPath'
import { useLegal } from '../../legal/LegalProvider'
import { haptic } from '../../utils/telegram'
import MetrikaConsentFullText from './MetrikaConsentFullText'
import './WebMetrikaConsentBanner.css'

/**
 * Compact, non-blocking floating banner: discloses Yandex Metrika before any tag.js load.
 * Refusal keeps the site fully usable. Choice is revocable in Profile.
 */
export default function WebMetrikaConsentBanner() {
  const legal = useLegal()
  const location = useLocation()
  const [consent, setConsent] = useState<MetrikaConsentState>(() =>
    isWebMetrikaFeatureEnabled() ? getMetrikaConsent() : 'denied'
  )
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [expanded, setExpanded] = useState(false)
  // «Позже»: hidden for this browser session only; nothing is stored as consent.
  const [later, setLater] = useState(() => isMetrikaPostponed())
  const [error, setError] = useState<string | null>(null)
  // The first-use sheet records "Later" in sessionStorage without any event; poll while it is open.
  const [sheetTick, setSheetTick] = useState(0)

  useEffect(() => {
    if (!isWebMetrikaFeatureEnabled()) return
    return subscribeMetrikaConsent((state) => setConsent(state))
  }, [])

  useEffect(() => {
    if (!isWebMetrikaFeatureEnabled()) return
    if (consent !== 'unknown' || later) {
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
  }, [consent, later, legal.status, legal.records?.agreement?.active, location.pathname, sheetTick])

  const accept = useCallback(() => {
    if (busy) return
    haptic('light')
    setBusy(true)
    setError(null)
    void (async () => {
      const saved = await persistMetrikaConsentEvidence('grant')
      if (!saved) {
        setBusy(false)
        setError('Не удалось сохранить согласие. Метрика не включена. Повторите позже.')
        return
      }
      setMetrikaConsent('granted')
      setConsent('granted')
      setVisible(false)
      setBusy(false)
      await enableYandexMetrika()
      hitYandexMetrika(normalizeMetrikaPath(location.pathname), document.title)
    })()
  }, [busy, location.pathname])

  const postpone = useCallback(() => {
    if (busy) return
    haptic('light')
    postponeMetrikaConsent()
    setLater(true)
    setVisible(false)
  }, [busy])

  const decline = useCallback(() => {
    if (busy) return
    haptic('light')
    setBusy(true)
    setError(null)
    void (async () => {
      const saved = await persistMetrikaConsentEvidence('decline')
      if (!saved) {
        setBusy(false)
        setError('Не удалось сохранить отказ. Повторите позже.')
        return
      }
      setMetrikaConsent('denied')
      setConsent('denied')
      setVisible(false)
      setBusy(false)
      disableYandexMetrika({ reload: true })
    })()
  }, [busy])

  if (!isWebMetrikaFeatureEnabled() || !visible || consent !== 'unknown' || later) return null

  return (
    <div className="web-metrika-banner" role="region" aria-label="Согласие на Яндекс Метрику">
      <div className="web-metrika-banner__card">
        <p className="web-metrika-banner__title">Аналитика сайта</p>
        <p className="web-metrika-banner__text">
          Мы используем Яндекс Метрику для анализа посещаемости сайта и эффективности рекламы. Метрика включается
          только с вашего согласия.{' '}
          <button
            type="button"
            className="web-metrika-banner__link"
            aria-expanded={expanded}
            aria-controls="web-metrika-banner-details"
            onClick={() => {
              haptic('light')
              setExpanded((v) => !v)
            }}
          >
            {expanded ? 'Свернуть' : 'Подробнее'}
          </button>
        </p>
        {expanded ? (
          <div id="web-metrika-banner-details" className="web-metrika-banner__details">
            <MetrikaConsentFullText hideSummary />
            <p className="web-metrika-banner__text">
              Подробности также в{' '}
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
              .
            </p>
          </div>
        ) : null}
        {error ? (
          <p className="web-metrika-banner__text web-metrika-banner__error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="web-metrika-banner__actions">
          <button
            type="button"
            className="web-metrika-banner__btn web-metrika-banner__btn--primary"
            aria-label="Разрешить Метрику"
            onClick={accept}
            disabled={busy}
          >
            Разрешить
          </button>
          <button
            type="button"
            className="web-metrika-banner__btn web-metrika-banner__btn--quiet"
            onClick={decline}
            disabled={busy}
          >
            Отказаться
          </button>
          <button
            type="button"
            className="web-metrika-banner__btn web-metrika-banner__btn--later"
            onClick={postpone}
            disabled={busy}
          >
            Позже
          </button>
        </div>
      </div>
    </div>
  )
}