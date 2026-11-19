import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { isWebShell } from '../config/shell'
import { completeTelegramLink } from '../lib/webAuth'
import { getInitData, getTelegramStartParam } from '../lib/telegram'
import { haptic } from '../utils/telegram'
import { usePremium } from '../contexts/PremiumContext'
import HomeButton from '../components/HomeButton'
import BackButton from '../components/BackButton'
import { useBack } from '../hooks/useBack'
import './WebTelegramLink.css'

const WL_TOKEN_RE = /^wl_[A-Za-z0-9_-]{16,60}$/

/**
 * Telegram Mini App: confirm one-click WEB link from startapp token.
 * No 8-digit codes. Identity is verified via signed initData on the server.
 */
export default function WebTelegramLink() {
  const handleBack = useBack('/')
  const navigate = useNavigate()
  const web = isWebShell()
  const hasInit = Boolean(getInitData())
  const { refreshPremium } = usePremium()
  const startParam = useMemo(() => getTelegramStartParam(), [])
  const token = WL_TOKEN_RE.test(startParam) ? startParam : ''
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (web) return
    if (!token && !window.location.hash.includes('link-web')) return
  }, [web, token])

  const onConfirm = useCallback(async () => {
    haptic('medium')
    setError(null)
    setStatus(null)
    if (!token) {
      setError('Ссылка привязки неполная или устарела. Вернитесь на сайт и нажмите «Связать с Telegram».')
      return
    }
    if (web || !hasInit) {
      setError('Откройте эту страницу внутри Telegram Mini App GameNight Host.')
      return
    }
    setBusy(true)
    try {
      const result = await completeTelegramLink(token)
      setDone(true)
      await refreshPremium()
      window.dispatchEvent(new Event('tcg_premium_sync'))
      if (result.isPremium || result.premium) {
        setStatus(
          result.activeUntil
            ? `Telegram подключён. Premium синхронизирован до ${new Date(result.activeUntil).toLocaleDateString('ru-RU')}.`
            : 'Telegram подключён. Premium синхронизирован.'
        )
      } else {
        setStatus('Аккаунты связаны. Premium пока не активен.')
      }
    } catch (reason) {
      const codeName =
        reason && typeof reason === 'object' && 'code' in reason
          ? String((reason as { code?: string }).code ?? '')
          : ''
      if (codeName === 'token_invalid' || codeName === 'invalid_token' || codeName === 'code_invalid') {
        setError('Ссылка недействительна или уже использована. Запросите новую на сайте.')
      } else if (codeName === 'telegram_already_linked') {
        setError('Этот Telegram уже связан с другим WEB-аккаунтом. Сначала отвяжите его там.')
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
  }, [token, hasInit, web, refreshPremium])

  return (
    <div className="web-tg-link">
      <div className="web-tg-link__top">
        <HomeButton className="web-tg-link__nav" />
        <BackButton onClick={handleBack} className="web-tg-link__nav" />
      </div>
      <h1 className="web-tg-link__title">Связать с сайтом</h1>
      <p className="web-tg-link__lead">
        Подтвердите привязку GameNight Host на сайте к этому Telegram. Premium станет общим — без
        повторной покупки и без изменения срока.
      </p>
      {web ? (
        <p className="web-tg-link__hint" role="status">
          Привязка подтверждается только внутри Telegram Mini App. На сайте нажмите «Связать с
          Telegram».
        </p>
      ) : null}
      {!web && !token ? (
        <p className="web-tg-link__hint" role="status">
          Откройте ссылку из WEB-профиля («Связать с Telegram»), чтобы подтвердить привязку одним
          нажатием.
        </p>
      ) : null}
      {!web && token ? (
        <button
          type="button"
          className="web-tg-link__submit"
          disabled={busy || done}
          onClick={() => void onConfirm()}
        >
          {busy ? 'Привязываем…' : done ? 'Готово' : 'Подтвердить'}
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
          <button type="button" className="web-tg-link__submit" onClick={() => navigate('/profile')}>
            Открыть профиль
          </button>
        </p>
      ) : (
        <p className="web-tg-link__foot">
          Нет активной ссылки? В WEB откройте{' '}
          <Link to="/profile" onClick={() => haptic('light')}>
            Профиль → Связать с Telegram
          </Link>
          .
        </p>
      )}
    </div>
  )
}