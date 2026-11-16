import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { isWebShell } from '../config/shell'
import { completeTelegramLink } from '../lib/webAuth'
import { getInitData } from '../lib/telegram'
import { haptic } from '../utils/telegram'
import HomeButton from '../components/HomeButton'
import BackButton from '../components/BackButton'
import { useBack } from '../hooks/useBack'
import './WebTelegramLink.css'

/**
 * Telegram Mini App screen: enter the 8-digit code from WEB Profile
 * to restore Telegram Premium onto the anonymous WEB account.
 */
export default function WebTelegramLink() {
  const handleBack = useBack('/')
  const web = isWebShell()
  const hasInit = Boolean(getInitData())
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = useCallback(async () => {
    haptic('medium')
    setError(null)
    setStatus(null)
    const trimmed = code.replace(/\D/g, '')
    if (!/^\d{8}$/.test(trimmed)) {
      setError('Введите 8 цифр кода из WEB-профиля.')
      return
    }
    if (web || !hasInit) {
      setError('Откройте эту страницу внутри Telegram Mini App GameNight Host.')
      return
    }
    setBusy(true)
    try {
      const result = await completeTelegramLink(trimmed)
      if (result.premium) {
        setStatus(
          result.activeUntil
            ? `Premium восстановлен до ${new Date(result.activeUntil).toLocaleDateString('ru-RU')}.`
            : 'Premium восстановлен на связанном WEB-аккаунте.'
        )
      } else {
        setStatus('Telegram привязан. Активный Premium на этом Telegram не найден.')
      }
      window.dispatchEvent(new Event('tcg_premium_sync'))
    } catch (reason) {
      const codeName =
        reason && typeof reason === 'object' && 'code' in reason
          ? String((reason as { code?: string }).code ?? '')
          : ''
      if (codeName === 'code_invalid') setError('Код неверный или устарел. Запросите новый в WEB-профиле.')
      else if (codeName === 'rate_limited') setError('Слишком много попыток. Подождите немного.')
      else setError('Не удалось подтвердить код. Попробуйте ещё раз.')
    } finally {
      setBusy(false)
    }
  }, [code, hasInit, web])

  return (
    <div className="web-tg-link">
      <div className="web-tg-link__top">
        <HomeButton className="web-tg-link__nav" />
        <BackButton onClick={handleBack} className="web-tg-link__nav" />
      </div>
      <h1 className="web-tg-link__title">Привязать WEB</h1>
      <p className="web-tg-link__lead">
        Введите восьмизначный код из браузерного профиля GameNight Host, чтобы перенести Premium с
        этого Telegram на WEB-аккаунт.
      </p>
      {web ? (
        <p className="web-tg-link__hint" role="status">
          Код создаётся на сайте. Подтверждение выполняется только в Telegram Mini App — откройте бота
          и раздел «Привязать WEB».
        </p>
      ) : null}
      <label className="web-tg-link__label">
        Код из WEB
        <input
          className="web-tg-link__input"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={8}
          placeholder="12345678"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
          disabled={busy}
        />
      </label>
      <button
        type="button"
        className="web-tg-link__submit"
        disabled={busy || code.replace(/\D/g, '').length !== 8}
        onClick={() => void onSubmit()}
      >
        {busy ? 'Проверяем…' : 'Подтвердить код'}
      </button>
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
      <p className="web-tg-link__foot">
        Нет кода? В WEB откройте{' '}
        <Link to="/profile" onClick={() => haptic('light')}>
          Профиль → Восстановить покупку из Telegram
        </Link>
        .
      </p>
    </div>
  )
}
