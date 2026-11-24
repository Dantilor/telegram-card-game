import { useEffect, useState } from 'react'
import {
  getMetrikaConsent,
  setMetrikaConsent,
  subscribeMetrikaConsent,
  type MetrikaConsentState,
} from '../../analytics/metrikaConsent'
import { disableYandexMetrika, enableYandexMetrika } from '../../analytics/yandexMetrika'

export default function MetrikaConsentControls() {
  const [state, setState] = useState<MetrikaConsentState>(() => getMetrikaConsent())
  useEffect(() => subscribeMetrikaConsent(setState), [])

  const allow = () => {
    setMetrikaConsent('granted')
    setState('granted')
    void enableYandexMetrika()
  }
  const deny = () => {
    setMetrikaConsent('denied')
    setState('denied')
    disableYandexMetrika()
  }

  const statusText =
    state === 'granted'
      ? 'Яндекс Метрика включена. Вебвизор выключен.'
      : state === 'denied'
        ? 'Яндекс Метрика выключена.'
        : 'Решение ещё не выбрано.'

  return (
    <div className="profile-consents__block">
      <h3 className="profile-consents__title">Яндекс Метрика</h3>
      <p className="profile-consents__text">{statusText}</p>
      <div className="profile-consents__actions">
        {state !== 'granted' ? (
          <button type="button" className="legal-choice__btn legal-choice__btn--quiet" onClick={allow}>
            Разрешить Метрику
          </button>
        ) : null}
        {state !== 'denied' ? (
          <button type="button" className="legal-choice__btn legal-choice__btn--quiet" onClick={deny}>
            {state === 'granted' ? 'Отключить Метрику' : 'Отказаться'}
          </button>
        ) : (
          <button type="button" className="legal-choice__btn legal-choice__btn--quiet" onClick={allow}>
            Включить снова
          </button>
        )}
      </div>
    </div>
  )
}