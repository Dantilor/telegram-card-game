import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { markTelegramStartParamConsumed, waitForTelegramStartParam } from '../lib/telegram'
import { completeTelegramWebLink } from '../lib/telegramWebLink'
import { waitForInitData } from '../lib/waitForInitData'
import { haptic } from '../utils/telegram'
import { usePremium } from '../contexts/PremiumContext'
import HomeButton from '../components/HomeButton'
import BackButton from '../components/BackButton'
import { useBack } from '../hooks/useBack'
import './WebTelegramLink.css'

const WL_TOKEN_RE = /^wl_[A-Za-z0-9_-]{16,60}$/

/**
 * Mini App screen for WEB Premium restore via one-time startapp token.
 * Manual confirm only — no silent auto-bind.
 */
export default function WebTelegramLink() {
  const handleBack = useBack('/')
  const navigate = useNavigate()
  const { refreshPremium } = usePremium()
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [bootHint, setBootHint] = useState('Подключаем Telegram…')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setBootHint('Подключаем Telegram…')
      const [initData, startParam] = await Promise.all([
        waitForInitData(4000),
        waitForTelegramStartParam(4000),
      ])
      if (cancelled) return
      const next = WL_TOKEN_RE.test(startParam) ? startParam : ''
      setToken(next)
      if (!next) {
        setBootHint(
          'Ссылка привязки не найдена. Вернитесь на сайт play.gamenighthost.ru и нажмите «Восстановить через Telegram».'
        )
      } else if (!initData) {
        setBootHint('Откройте эту страницу внутри Telegram Mini App GameNight Host.')
      } else {
        setBootHint('')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const onConfirm = useCallback(async () => {
    haptic('medium')
    setError(null)
    setStatus(null)
    if (!token) {
      setError(
        'Ссылка привязки неполная или устарела. Вернитесь на сайт и нажмите «Восстановить через Telegram».'
      )
      return
    }
    const initData = await waitForInitData(2500)
    if (!initData) {
      setError('Откройте эту страницу внутри Telegram Mini App GameNight Host.')
      return
    }
    setBusy(true)
    try {
      const result = await completeTelegramWebLink(token)
      markTelegramStartParamConsumed(token)
      setDone(true)
      await refreshPremium()
      try {
        window.dispatchEvent(new Event('tcg_premium_sync'))
      } catch {
        /* ignore */
      }
      if (result.isPremium || result.premium) {
        setStatus(
          result.activeUntil
            ? `Telegram подключён! Premium доступен на сайте до ${new Date(result.activeUntil).toLocaleDateString('ru-RU')}.`
            : 'Telegram подключён! Premium доступен на сайте.'
        )
      } else {
        setStatus('Telegram подключён, но активный Premium не найден.')
      }
    } catch (reason) {
      const codeName =
        reason && typeof reason === 'object' && 'code' in reason
          ? String((reason as { code?: string }).code ?? '')
          : ''
      if (codeName === 'token_invalid' || codeName === 'invalid_token' || codeName === 'code_invalid') {
        setError('Ссылка недействительна или уже использована. Запросите новую на сайте.')
      } else if (codeName === 'telegram_init_required') {
        setError('Telegram не передал данные входа. Закройте Mini App и откройте ссылку снова с сайта.')
      } else if (codeName === 'telegram_already_linked') {
        setError('Этот Telegram уже связан с другим WEB-аккаунтом.')
      } else if (codeName === 'web_already_linked') {
        setError('WEB-аккаунт уже связан с другим Telegram.')
      } else if (codeName === 'rate_limited') {
        setError('Слишком много попыток. Подождите немного.')
      } else {
        setError('Не удалось подтвердить привязку. Попробуйте ещё раз.')
      }
    } finally {
      setBusy(false)
    }
  }, [token, refreshPremium])

  return (
    <div className="web-tg-link">
      <div className="web-tg-link__top">
        <HomeButton className="web-tg-link__nav" />
        <BackButton onClick={handleBack} className="web-tg-link__nav" />
      </div>
      <h1 className="web-tg-link__title">Подключить Premium к сайту</h1>
      <p className="web-tg-link__lead">
        Вы подключаете свой Telegram-аккаунт к GameNight Host. Если у вас есть действующий Premium, он
        станет доступен на сайте без повторной покупки.
      </p>
      {bootHint ? (
        <p className="web-tg-link__hint" role="status">
          {bootHint}
        </p>
      ) : null}
      {token && !done ? (
        <button
          type="button"
          className="web-tg-link__submit"
          disabled={busy}
          onClick={() => void onConfirm()}
        >
          {busy ? 'Подключаем…' : 'Подключить'}
        </button>
      ) : null}
      {error ? (
        <p className="web-tg-link__error" role="alert">
          {error}
        </p>
      ) : null}
      {status ? (
        <p className="web-tg-link__ok" role="status">
          {status}
        </p>
      ) : null}
      {done ? (
        <p className="web-tg-link__foot">
          Можно вернуться на сайт — Premium уже доступен. Или продолжите в Mini App.
          <button
            type="button"
            className="web-tg-link__submit"
            onClick={() => {
              haptic('light')
              navigate('/', { replace: true })
            }}
          >
            Открыть GameNight Host
          </button>
        </p>
      ) : null}
    </div>
  )
}
