import { useEffect, useState } from 'react'
import { isWebMetrikaFeatureEnabled } from '../../analytics/metrikaFeature'
import {
  getMetrikaConsent,
  setMetrikaConsent,
  subscribeMetrikaConsent,
  type MetrikaConsentState,
} from '../../analytics/metrikaConsent'
import { disableYandexMetrika, enableYandexMetrika } from '../../analytics/yandexMetrika'
import { persistMetrikaConsentEvidence } from '../../analytics/persistMetrikaConsent'
import MetrikaConsentFullText from './MetrikaConsentFullText'

export default function MetrikaConsentControls() {
  const [state, setState] = useState<MetrikaConsentState>(() => getMetrikaConsent())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => subscribeMetrikaConsent(setState), [])

  const allow = () => {
    if (busy) return
    setBusy(true)
    setError(null)
    void (async () => {
      const saved = await persistMetrikaConsentEvidence('grant')
      if (!saved) {
        setBusy(false)
        setError('Не удалось сохранить согласие. Метрика не включена.')
        return
      }
      setMetrikaConsent('granted')
      setState('granted')
      setBusy(false)
      void enableYandexMetrika()
    })()
  }
  const deny = () => {
    if (busy) return
    setBusy(true)
    setError(null)
    void (async () => {
      const action = state === 'granted' ? 'withdraw' : 'decline'
      const saved = await persistMetrikaConsentEvidence(action)
      if (!saved) {
        setBusy(false)
        setError('Не удалось сохранить отзыв. Повторите позже.')
        return
      }
      setMetrikaConsent('denied')
      setState('denied')
      setBusy(false)
      // Reload clears in-memory tag handlers after destruct + official opt-out.
      disableYandexMetrika({ reload: true })
    })()
  }

  if (!isWebMetrikaFeatureEnabled()) return null

  const statusText =
    state === 'granted'
      ? 'Яндекс Метрика включена. Вебвизор, карта кликов и слежение за ссылками выключены.'
      : state === 'denied'
        ? 'Яндекс Метрика выключена: новые обращения счётчика не отправляются. Уже переданные Яндексу данные этим действием не удаляются.'
        : 'Решение ещё не выбрано. Перед включением прочитайте полный текст согласия ниже.'

  return (
    <div className="profile-consents__block">
      <h3 className="profile-consents__title">Яндекс Метрика</h3>
      <p className="profile-consents__text">{statusText}</p>
      {error ? <p className="profile-consents__text">{error}</p> : null}
      {state !== 'granted' ? <MetrikaConsentFullText /> : null}
      <div className="profile-consents__actions">
        {state !== 'granted' ? (
          <button type="button" className="legal-choice__btn legal-choice__btn--quiet" onClick={allow} disabled={busy}>
            Разрешить Метрику
          </button>
        ) : null}
        {state !== 'denied' ? (
          <button type="button" className="legal-choice__btn legal-choice__btn--quiet" onClick={deny} disabled={busy}>
            {state === 'granted' ? 'Отключить Метрику' : 'Отказаться'}
          </button>
        ) : (
          <button type="button" className="legal-choice__btn legal-choice__btn--quiet" onClick={allow} disabled={busy}>
            Включить снова
          </button>
        )}
      </div>
    </div>
  )
}