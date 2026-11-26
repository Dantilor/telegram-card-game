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
import { persistMetrikaConsentEvidence } from '../../analytics/persistMetrikaConsent'
import { normalizeMetrikaPath } from '../../analytics/metrikaPath'
import { useLegal } from '../../legal/LegalProvider'
import { haptic } from '../../utils/telegram'
import MetrikaConsentFullText from './MetrikaConsentFullText'
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
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
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

  if (!isWebMetrikaFeatureEnabled() || !visible || consent !== 'unknown') return null

  return (
    <div className="web-metrika-banner" role="dialog" aria-label="Согласие на Яндекс Метрику">
      <div className="web-metrika-banner__card">
        <p className="web-metrika-banner__title">Аналитика сайта</p>
        <p className="web-metrika-banner__text">
          Отдельное согласие на Яндекс Метрику (счётчик 114652319). Это не согласие на собственную аналитику
          Оператора. Cookie Яндекса загружаются только после «Разрешить Метрику». Вебвизор, карта кликов и
          слежение за ссылками выключены. Отказ не мешает играть и покупать Premium. Полный текст — ниже;
          подробности также в{' '}
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
        <MetrikaConsentFullText defaultOpen />
        {error ? <p className="web-metrika-banner__text">{error}</p> : null}
        <div className="web-metrika-banner__actions">
          <button
            type="button"
            className="web-metrika-banner__btn web-metrika-banner__btn--primary"
            onClick={accept}
            disabled={busy}
          >
            Разрешить Метрику
          </button>
          <button
            type="button"
            className="web-metrika-banner__btn web-metrika-banner__btn--quiet"
            onClick={decline}
            disabled={busy}
          >
            Отказаться
          </button>
        </div>
      </div>
    </div>
  )
}