import { useEffect, useState } from 'react'
import { isWebMetrikaFeatureEnabled } from '../../analytics/metrikaFeature'
import {
  getMetrikaConsent,
  setMetrikaConsent,
  subscribeMetrikaConsent,
  type MetrikaConsentState,
} from '../../analytics/metrikaConsent'
import { disableYandexMetrika, enableYandexMetrika } from '../../analytics/yandexMetrika'
import MetrikaConsentFullText from './MetrikaConsentFullText'

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
    // Reload clears in-memory tag handlers after destruct + official opt-out.
    disableYandexMetrika({ reload: true })
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
      {state !== 'granted' ? <MetrikaConsentFullText /> : null}
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