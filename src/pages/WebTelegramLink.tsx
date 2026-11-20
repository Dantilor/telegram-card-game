import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { isWebShell } from '../config/shell'
import { completeTelegramLink } from '../lib/webAuth'
import { waitForTelegramStartParam } from '../lib/telegram'
import { waitForInitData } from '../lib/waitForInitData'
import { haptic } from '../utils/telegram'
import { usePremium } from '../contexts/PremiumContext'
import HomeButton from '../components/HomeButton'
import BackButton from '../components/BackButton'
import { useBack } from '../hooks/useBack'
import './WebTelegramLink.css'

const WL_TOKEN_RE = /^wl_[A-Za-z0-9_-]{16,60}$/

/**
 * Telegram Mini App: confirm one-click WEB link from startapp token.
 * Waits for late SDK/initData so startapp is not missed on cold launch.
 */
export default function WebTelegramLink() {
  const handleBack = useBack('/')
  const navigate = useNavigate()
  const web = isWebShell()
  const { refreshPremium } = usePremium()
  const [token, setToken] = useState('')
  const [initReady, setInitReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [bootHint, setBootHint] = useState('Подключаем Telegram…')
  const autoStarted = useRef(false)

  useEffect(() => {
    if (web) return
    let cancelled = false
    void (async () => {
      setBootHint('Подключаем Telegram…')
      const [initData, startParam] = await Promise.all([
        waitForInitData(4000),
        waitForTelegramStartParam(4000),
      ])
      if (cancelled) return
      setInitReady(Boolean(initData))
      const next = WL_TOKEN_RE.test(startParam) ? startParam : ''
      setToken(next)
      if (!next) {
        setBootHint('Ссылка привязки не найдена. Вернитесь на сайт и нажмите «Восстановить через Telegram».')
      } else if (!initData) {
        setBootHint('Откройте эту страницу внутри Telegram Mini App GameNight Host.')
      } else {
        setBootHint('')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [web])

  const onConfirm = useCallback(async () => {
    haptic('medium')
    setError(null)
    setStatus(null)
    if (!token) {
      setError('Ссылка привязки неполная или устарела. Вернитесь на сайт и нажмите «Восстановить через Telegram».')
      return
    }
    if (web) {
      setError('Привязка подтверждается только внутри Telegram Mini App.')
      return
    }
    const initData = await waitForInitData(2500)
    if (!initData) {
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
            ? `Telegram подключён. Premium восстановлен до ${new Date(result.activeUntil).toLocaleDateString('ru-RU')}.`
            : 'Telegram подключён. Premium восстановлен!'
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
        setError('Telegram не передал данные входа. Закройте Mini App и откройте ссылку снова из профиля на сайте.')
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
  }, [token, web, refreshPremium])

  // One short confirm action as soon as Mini App + token are ready.
  useEffect(() => {
    if (web || done || busy || autoStarted.current) return
    if (!token || !initReady) return
    autoStarted.current = true
    void onConfirm()
  }, [web, token, initReady, done, busy, onConfirm])

  return (
    <div className="web-tg-link">
      <div className="web-tg-link__top">
        <HomeButton className="web-tg-link__nav" />
        <BackButton onClick={handleBack} className="web-tg-link__nav" />
      </div>
      <h1 className="web-tg-link__title">Восстановить Premium</h1>
      <p className="web-tg-link__lead">
        Подтвердите связь с сайтом GameNight Host. Действующий Telegram Premium станет доступен в
        WEB без повторной оплаты и без изменения срока.
      </p>
      {web ? (
        <p className="web-tg-link__hint" role="status">
          Привязка подтверждается только внутри Telegram Mini App. На сайте нажмите «Восстановить
          через Telegram».
        </p>
      ) : null}
      {!web && bootHint ? (
        <p className="web-tg-link__hint" role="status">
          {bootHint}
        </p>
      ) : null}
      {!web && token && !done ? (
        <button
          type="button"
          className="web-tg-link__submit"
          disabled={busy}
          onClick={() => void onConfirm()}
        >
          {busy ? 'Привязываем…' : 'Подтвердить'}
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
            Профиль → Восстановить через Telegram
          </Link>
          .
        </p>
      )}
    </div>
  )
}
