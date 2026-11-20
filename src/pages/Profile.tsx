import { useState, useCallback, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useBack } from '../hooks/useBack'
import { usePremium } from '../contexts/PremiumContext'
import { getTelegramWebApp } from '../lib/telegram'
import { PROFILE_DOCUMENTS } from '../legal/catalog'
import { ConsentsPanel } from '../components/LegalChoices'
import { useLegal } from '../legal/LegalProvider'
import { haptic, getTgUser, getInitData } from '../utils/telegram'
import HomeButton from '../components/HomeButton'
import BackButton from '../components/BackButton'
import PremiumOverlay from '../components/PremiumOverlay'
import { isWebShell } from '../config/shell'
import { useWebSession } from '../shell/WebSessionContext'
import {
  fetchTelegramLinkStatus,
  startEmailBind,
  startTelegramLinkRestore,
  unlinkTelegramLink,
} from '../lib/webAuth'
import './Profile.css'
import ProfileFaq from '../components/web/ProfileFaq'
import { openWebInstallPrompt } from '../components/web/WebInstallBanner'
import { readWebDisplayName, writeWebDisplayName } from '../lib/webDisplayName'
import { isStandaloneDisplay } from '../lib/webInstall'

const SUPPORT_BOT_URL = 'https://t.me/GameNightHelp'

const PREMIUM_PERKS = ['8 игр', 'Избранное', '18+ режимы', 'Без автосписаний']

type TgRestorePanel = {
  expiresAt: string
  instruction: string
  phase: 'waiting' | 'linked' | 'expired' | 'error'
  message: string | null
  activeUntil: string | null
  isPremium: boolean | null
}

function getInitials(firstName?: string, lastName?: string): string {
  const first = firstName?.trim()[0] ?? ''
  const last = lastName?.trim()[0] ?? ''
  return (first + last).toUpperCase() || '?'
}

function formatPremiumUntilDate(activeUntil: string | null): string | null {
  if (!activeUntil) return null
  const until = new Date(activeUntil)
  if (!Number.isFinite(until.getTime())) return null
  return until.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

function daysRemaining(activeUntil: string | null): number | null {
  if (!activeUntil) return null
  const until = new Date(activeUntil).getTime()
  if (!Number.isFinite(until)) return null
  const days = Math.ceil((until - Date.now()) / 86_400_000)
  return days > 0 ? days : null
}

function formatDaysLeftLabel(days: number): string {
  const n = Math.abs(days) % 100
  const n1 = n % 10
  let word = 'дней'
  if (n > 10 && n < 20) word = 'дней'
  else if (n1 === 1) word = 'день'
  else if (n1 >= 2 && n1 <= 4) word = 'дня'
  return `Осталось ${days} ${word}`
}

function Profile() {
  const handleBack = useBack('/')
  const tgUser = getTgUser()
  const webSession = useWebSession()
  const navigate = useNavigate()
  const location = useLocation()
  const web = isWebShell()
  const [localDisplayName, setLocalDisplayName] = useState(() => readWebDisplayName())
  const [nameDraft, setNameDraft] = useState(() => readWebDisplayName())
  const [nameStatus, setNameStatus] = useState<string | null>(null)
  const localName = localDisplayName
  const user = web
    ? (() => {
        const session = webSession.session
        const tgLinkedNow = Boolean(session?.telegramId || session?.username)
        if (tgLinkedNow) {
          const full = session?.displayName?.trim() || 'Игрок'
          const parts = full.split(/\s+/)
          return {
            first_name: parts[0] || 'Игрок',
            last_name: parts.slice(1).join(' ') || undefined,
            username: session?.username ?? undefined,
            photo_url: session?.pictureUrl ?? undefined,
            id: session?.telegramId ?? undefined,
          }
        }
        const name = localName || 'Игрок'
        return {
          first_name: name,
          last_name: undefined,
          username: undefined,
          photo_url: session?.pictureUrl ?? undefined,
          id: undefined,
        }
      })()
    : tgUser
  const {
    isPremium,
    activeUntil,
    isLifetime,
    lastEndedAt,
    authError,
    authError401,
    serverError503,
    refreshPremium,
  } = usePremium()
  const initData = getInitData()
  const userId = web ? webSession.session?.telegramId : (initData.userId ?? initData.user?.id)
  const webAccountId = web ? webSession.session?.webAccountId : null
  const legal = useLegal()
  const [premiumOverlayOpen, setPremiumOverlayOpen] = useState(false)
  const [restoreStatus, setRestoreStatus] = useState<string | null>(null)
  const [restoreLoading, setRestoreLoading] = useState(false)
  const [tgRestore, setTgRestore] = useState<TgRestorePanel | null>(null)
  const [tgLinked, setTgLinked] = useState(false)
  const [tgLinkPremium, setTgLinkPremium] = useState(false)
  const [logoutBusy, setLogoutBusy] = useState(false)
  const [emailDraft, setEmailDraft] = useState('')
  const [emailBusy, setEmailBusy] = useState(false)
  const [emailStatus, setEmailStatus] = useState<string | null>(null)
  const restoreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tgPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopTgPoll = useCallback(() => {
    if (tgPollRef.current) {
      clearInterval(tgPollRef.current)
      tgPollRef.current = null
    }
  }, [])

  const handleRestorePurchase = useCallback(async () => {
    haptic('medium')
    if (restoreTimerRef.current) clearTimeout(restoreTimerRef.current)
    setRestoreStatus(null)
    setRestoreLoading(true)
    try {
      const result = await refreshPremium()
      if (result?.isPremium) {
        setRestoreStatus('✅ Покупки восстановлены')
        return
      }
      if (web) {
        navigate('/login')
        return
      }
      setRestoreStatus('Покупок не найдено')
    } catch {
      setRestoreStatus('Ошибка синхронизации')
    } finally {
      setRestoreLoading(false)
      restoreTimerRef.current = setTimeout(() => {
        setRestoreStatus(null)
        restoreTimerRef.current = null
      }, 2500)
    }
  }, [navigate, refreshPremium, web])

  const handleLinkTelegram = useCallback(async () => {
    if (!web) return
    haptic('medium')
    stopTgPoll()
    setRestoreLoading(true)
    // Open a tab synchronously (user gesture) so Safari/PWA do not block the deep link.
    let opener: Window | null = null
    try {
      opener = window.open('about:blank', '_blank')
    } catch {
      opener = null
    }
    try {
      // Already linked → just refresh Premium, no new challenge.
      const current = await fetchTelegramLinkStatus().catch(() => null)
      if (current?.linked) {
        if (opener && !opener.closed) opener.close()
        setTgLinked(true)
        setTgLinkPremium(Boolean(current.isPremium))
        await refreshPremium()
        try {
          window.dispatchEvent(new Event('tcg_premium_sync'))
        } catch {
          /* ignore */
        }
        setTgRestore({
          expiresAt: '',
          instruction: '',
          phase: 'linked',
          message: current.isPremium
            ? 'Telegram подключён. Premium восстановлен!'
            : 'Telegram подключён, но активный Premium не найден.',
          activeUntil: current.activeUntil,
          isPremium: current.isPremium,
        })
        return
      }

      const started = await startTelegramLinkRestore()
      if (!started.deepLink || !started.expiresAt) {
        if (opener && !opener.closed) opener.close()
        setTgRestore({
          expiresAt: '',
          instruction: started.instruction || '',
          phase: 'error',
          message: 'Сервер не вернул ссылку привязки. Попробуйте позже.',
          activeUntil: null,
          isPremium: null,
        })
        return
      }
      setTgRestore({
        expiresAt: started.expiresAt,
        instruction:
          started.instruction ||
          'Откроется Telegram Mini App GameNight Host. Подтвердите привязку одним нажатием.',
        phase: 'waiting',
        message: 'Ожидаем подключение Telegram…',
        activeUntil: null,
        isPremium: null,
      })
      if (opener && !opener.closed) {
        opener.location.href = started.deepLink
      } else {
        window.location.assign(started.deepLink)
      }
    } catch (reason) {
      if (opener && !opener.closed) opener.close()
      const codeName =
        reason && typeof reason === 'object' && 'code' in reason
          ? String((reason as { code?: string }).code ?? '')
          : ''
      if (codeName === 'web_already_linked') {
        try {
          const status = await fetchTelegramLinkStatus()
          setTgLinked(Boolean(status.linked))
          setTgLinkPremium(Boolean(status.isPremium))
          await refreshPremium()
          window.dispatchEvent(new Event('tcg_premium_sync'))
          setTgRestore({
            expiresAt: '',
            instruction: '',
            phase: 'linked',
            message: status.isPremium
              ? 'Telegram подключён. Premium восстановлен!'
              : 'Telegram подключён, но активный Premium не найден.',
            activeUntil: status.activeUntil,
            isPremium: status.isPremium,
          })
          return
        } catch {
          /* fall through */
        }
      }
      setTgRestore({
        expiresAt: '',
        instruction: '',
        phase: 'error',
        message:
          codeName === 'telegram_already_linked'
            ? 'Этот Telegram уже связан с другим WEB-аккаунтом.'
            : codeName === 'rate_limited'
              ? 'Слишком много попыток. Подождите немного.'
              : 'Не удалось начать восстановление через Telegram',
        activeUntil: null,
        isPremium: null,
      })
    } finally {
      setRestoreLoading(false)
    }
  }, [web, stopTgPoll, refreshPremium])

  const handleUnlinkTelegram = useCallback(async () => {
    if (!web) return
    haptic('medium')
    setRestoreLoading(true)
    try {
      const result = await unlinkTelegramLink()
      setTgLinked(false)
      setTgRestore(null)
      await refreshPremium()
      setRestoreStatus(
        result.revoked
          ? 'Привязка Telegram отключена. WEB-покупки сохранены.'
          : 'Активной привязки не найдено'
      )
    } catch {
      setRestoreStatus('Не удалось отвязать Telegram')
    } finally {
      setRestoreLoading(false)
      if (restoreTimerRef.current) clearTimeout(restoreTimerRef.current)
      restoreTimerRef.current = setTimeout(() => {
        setRestoreStatus(null)
        restoreTimerRef.current = null
      }, 2500)
    }
  }, [web, refreshPremium])

  useEffect(() => {
    if (!web || !tgRestore || tgRestore.phase !== 'waiting') {
      stopTgPoll()
      return
    }
    let cancelled = false
    const tick = async () => {
      try {
        if (new Date(tgRestore.expiresAt).getTime() <= Date.now()) {
          if (!cancelled) {
            setTgRestore((prev) =>
              prev
                ? {
                    ...prev,
                    phase: 'expired',
                    message: 'Время подключения истекло. Попробуйте ещё раз.',
                  }
                : prev
            )
          }
          stopTgPoll()
          return
        }
        const status = await fetchTelegramLinkStatus()
        if (cancelled) return
        if (status.linked) {
          stopTgPoll()
          setTgLinked(true)
          setTgLinkPremium(Boolean(status.isPremium))
          await webSession.refreshSession()
          await refreshPremium()
          try {
            window.dispatchEvent(new Event('tcg_premium_sync'))
          } catch {
            /* ignore */
          }
          setTgRestore((prev) =>
            prev
              ? {
                  ...prev,
                  phase: 'linked',
                  message: status.isPremium
                    ? 'Telegram подключён. Premium восстановлен!'
                    : 'Telegram подключён, но активный Premium не найден.',
                  activeUntil: status.activeUntil,
                  isPremium: status.isPremium,
                }
              : prev
          )
        }
      } catch {
        /* keep polling; transient network */
      }
    }
    void tick()
    tgPollRef.current = setInterval(() => {
      void tick()
    }, 2500)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void tick()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('pageshow', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      cancelled = true
      stopTgPoll()
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('pageshow', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [web, tgRestore?.phase, tgRestore?.expiresAt, refreshPremium, stopTgPoll, webSession])

  useEffect(() => {
    if (!web) return
    let cancelled = false
    void fetchTelegramLinkStatus()
      .then((status) => {
        if (!cancelled) {
          setTgLinked(Boolean(status.linked))
          setTgLinkPremium(Boolean(status.isPremium))
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [web])

  useEffect(() => {
    const toast = (location.state as { emailAuthToast?: string } | null)?.emailAuthToast
    if (!toast) return
    setEmailStatus(toast)
    navigate(location.pathname, { replace: true, state: null })
  }, [location.state, location.pathname, navigate])

  useEffect(() => {
    return () => {
      if (restoreTimerRef.current) clearTimeout(restoreTimerRef.current)
      stopTgPoll()
    }
  }, [stopTgPoll])

  const savedEmail = webSession.session?.email?.trim() || ''
  const emailVerified = Boolean(webSession.session?.emailVerified)

  useEffect(() => {
    if (!web) return
    let cancelled = false
    void webSession.refreshSession().then(() => {
      if (cancelled) return
    })
    return () => {
      cancelled = true
    }
    // Refresh once when opening Profile — callbacks from context are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [web])

  const handleEmailConfirm = useCallback(async () => {
    if (!web) return
    const target = (savedEmail || emailDraft).trim()
    if (!target) return
    haptic('medium')
    setEmailBusy(true)
    setEmailStatus(null)
    try {
      const result = await startEmailBind(target)
      await webSession.refreshSession()
      try {
        window.dispatchEvent(new Event('tcg_premium_sync'))
      } catch {
        /* ignore */
      }
      if (result.mode === 'restored') {
        setEmailStatus('Аккаунт восстановлен')
      } else {
        setEmailStatus('Аккаунт создан')
      }
    } catch (e) {
      const status = (e as Error & { status?: number }).status
      const code = (e as Error & { code?: string }).code
      if (status === 409 || code === 'email_already_verified') {
        setEmailStatus('Не удалось сохранить этот email. Попробуйте другой адрес.')
      } else if (status === 429) {
        setEmailStatus('Слишком много попыток. Подождите минуту и попробуйте снова.')
      } else {
        setEmailStatus('Не удалось сохранить email. Попробуйте позже.')
      }
    } finally {
      setEmailBusy(false)
    }
  }, [web, savedEmail, emailDraft, webSession])

  const handleSupport = useCallback(() => {
    haptic('light')
    const tg = getTelegramWebApp()
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(SUPPORT_BOT_URL)
    } else {
      window.open(SUPPORT_BOT_URL, '_blank', 'noopener,noreferrer')
    }
  }, [])

  const handleLogout = useCallback(async () => {
    if (!web) return
    haptic('light')
    const verified = Boolean(webSession.session?.emailVerified)
    if (!verified) {
      const ok = window.confirm(
        'Почта ещё не подтверждена. После выхода Premium на этом устройстве может быть недоступен, пока вы не войдёте по email. Выйти?'
      )
      if (!ok) return
    }
    setLogoutBusy(true)
    try {
      await webSession.logout()
      window.location.assign('/')
    } finally {
      setLogoutBusy(false)
    }
  }, [web, webSession])

  const getErrorMessage = () => {
    if (web) {
      if (serverError503) return 'Сервис временно недоступен, попробуйте позже'
      // Anonymous WEB is normal; 401 before cookie bootstrap is not a login requirement.
      if ((authError401 || authError) && !webAccountId && !userId) return null
      if (authError401 || authError) {
        return 'Сессия устройства недоступна. Обновите страницу или восстановите покупку по email.'
      }
      return null
    }
    if (authError401) return 'Откройте внутри Telegram'
    if (serverError503) return 'Сервис временно недоступен, попробуйте позже'
    if (authError) return 'Откройте внутри Telegram'
    return null
  }

  const errorMessage = getErrorMessage()
  const premiumUntilDate = formatPremiumUntilDate(activeUntil)
  const premiumDaysLeft = daysRemaining(activeUntil)
  const premiumExpired = !isPremium && Boolean(lastEndedAt)
  const tgExpiresLabel = tgRestore?.expiresAt
    ? new Date(tgRestore.expiresAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    : null

  const tgRestorePanel =
    web && tgRestore ? (
      <div className="profile-pass__tg-restore" role="status" aria-live="polite">
        <p className="profile-pass__eyebrow">Связь с Telegram</p>
        {tgRestore.phase === 'waiting' ? (
          <>
            <p className="profile-pass__desc">{tgRestore.instruction}</p>
            <p className="profile-pass__desc">
              Ссылка действует до {tgExpiresLabel || 'истечения срока'}. Ожидаем подтверждение в Mini
              App…
            </p>
          </>
        ) : null}
        {tgRestore.phase === 'linked' ? (
          <>
            <p className="profile-pass__desc profile-pass__desc--ok">
              {tgRestore.isPremium
                ? 'Telegram подключён. Premium восстановлен!'
                : tgRestore.message || 'Telegram подключён, но активный Premium не найден.'}
            </p>
            <p className="profile-pass__active-date">
              {tgRestore.isPremium
                ? formatPremiumUntilDate(tgRestore.activeUntil ?? activeUntil)
                  ? `Действует до: ${formatPremiumUntilDate(tgRestore.activeUntil ?? activeUntil)}`
                  : 'Premium активен'
                : 'Premium пока не активен'}
            </p>
          </>
        ) : null}
        {tgRestore.phase === 'expired' || tgRestore.phase === 'error' ? (
          <>
            <p className="profile-pass__desc">{tgRestore.message}</p>
            <button
              type="button"
              className="profile-pass__restore"
              onClick={() => void handleLinkTelegram()}
              disabled={restoreLoading}
            >
              Восстановить через Telegram
            </button>
          </>
        ) : null}
      </div>
    ) : null

  return (
    <div className="profile-page" aria-label="Профиль">
      <div className="profile-page__header">
        <HomeButton className="profile-page__nav-btn" />
        <BackButton onClick={handleBack} className="profile-page__nav-btn profile-page__back" />
      </div>

      <div className="profile-shell">
        <section className="profile-identity">
          <div className="profile-identity__glow" aria-hidden />
          <div className="profile-identity__avatar-wrap">
            {user?.photo_url ? (
              <img
                src={user.photo_url}
                alt=""
                className="profile-identity__photo"
                decoding="async"
                loading="lazy"
              />
            ) : (
              <div className="profile-identity__initials" aria-hidden>
                {user ? getInitials(user.first_name, user.last_name) : 'GN'}
              </div>
            )}
            {isPremium && <span className="profile-identity__crown" aria-hidden>✦</span>}
          </div>

          {user ? (
            <>
              <p className="profile-identity__name">
                {user.first_name}
                {user.last_name ? ` ${user.last_name}` : ''}
              </p>
              {user.username && (
                <p className="profile-identity__username">@{user.username}</p>
              )}
            </>
          ) : (
            <p className="profile-identity__guest">
              {web
                ? 'Анонимный WEB-профиль. Покупки сохраняются в cookie этого устройства.'
                : 'Откройте приложение внутри Telegram, чтобы увидеть профиль и статус Premium'}
            </p>
          )}
          {web && webAccountId && (
            <p className="profile-identity__username">WEB · покупки на этом устройстве</p>
          )}
          {web && userId != null && (
            <p className="profile-identity__username">Telegram ID {userId}</p>
          )}

          {web && !tgLinked && userId == null && (
            <div className="profile-identity__name-edit">
              <label className="profile-pass__email-label">
                Как к вам обращаться?
                <input
                  type="text"
                  className="profile-pass__email-input"
                  value={nameDraft}
                  maxLength={40}
                  placeholder="Необязательно"
                  autoComplete="nickname"
                  onChange={(e) => setNameDraft(e.target.value)}
                />
              </label>
              <button
                type="button"
                className="profile-pass__restore"
                onClick={() => {
                  haptic('light')
                  const saved = writeWebDisplayName(nameDraft)
                  setLocalDisplayName(saved)
                  setNameDraft(saved)
                  setNameStatus(saved ? 'Имя сохранено на этом устройстве' : 'Имя очищено')
                  window.setTimeout(() => setNameStatus(null), 2000)
                }}
              >
                Сохранить имя
              </button>
              {nameStatus && <span className="profile-pass__toast">{nameStatus}</span>}
            </div>
          )}

          <span className={`profile-identity__badge${isPremium ? ' profile-identity__badge--pro' : ''}`}>
            {isPremium ? 'Premium активен' : 'Free'}
          </span>
        </section>

        {errorMessage && (
          <p className="profile-alert profile-alert--error">{errorMessage}</p>
        )}

        <section className={`profile-pass${isPremium ? ' profile-pass--active' : ''}`}>
          {isPremium ? (
            <div className="profile-pass__active">
              <div className="profile-pass__active-head">
                <span className="profile-pass__gem" aria-hidden>💎</span>
                <div>
                  <p className="profile-pass__active-label">GameNight Premium</p>
                  <p className="profile-pass__active-date">Статус: Активен</p>
                  {isLifetime ? (
                    <p className="profile-pass__active-until">Premium навсегда ♾️</p>
                  ) : (
                    <>
                      {premiumUntilDate ? (
                        <p className="profile-pass__active-until">Действует до: {premiumUntilDate}</p>
                      ) : null}
                      {premiumDaysLeft != null ? (
                        <p className="profile-pass__active-days">{formatDaysLeftLabel(premiumDaysLeft)}</p>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
              <button
                type="button"
                className="profile-pass__restore"
                onClick={handleRestorePurchase}
                disabled={restoreLoading}
              >
                {restoreLoading ? 'Загрузка…' : 'Обновить статус Premium'}
              </button>
              {web && !tgLinked && userId == null && (
                <button
                  type="button"
                  className="profile-pass__restore"
                  onClick={() => void handleLinkTelegram()}
                  disabled={restoreLoading || tgRestore?.phase === 'waiting'}
                >
                  {tgRestore?.phase === 'waiting'
                    ? 'Ожидаем подтверждение…'
                    : 'Восстановить через Telegram'}
                </button>
              )}
              {web && tgLinked && !tgRestore && (
                <>
                  <p className="profile-pass__desc profile-pass__desc--ok">
                    Telegram подключён
                    {tgLinkPremium || isPremium
                      ? '. Premium синхронизирован.'
                      : '. Premium пока не активен.'}
                  </p>
                  <button
                    type="button"
                    className="profile-pass__restore"
                    onClick={() => void handleUnlinkTelegram()}
                    disabled={restoreLoading}
                  >
                    Отвязать Telegram
                  </button>
                </>
              )}
              {tgRestorePanel}
              {!web && (
                <Link to="/link-web" className="profile-pass__restore" onClick={() => haptic('light')}>
                  Связать с сайтом
                </Link>
              )}
              {restoreStatus && (
                <span className="profile-pass__toast">{restoreStatus}</span>
              )}
            </div>
          ) : (
            <div className="profile-pass__inactive">
              <div className="profile-pass__head">
                <span className="profile-pass__gem" aria-hidden>💎</span>
                <div>
                  <p className="profile-pass__eyebrow">GameNight Premium</p>
                  <p className="profile-pass__title">
                    {premiumExpired ? 'Срок Premium закончился' : 'Premium не активен'}
                  </p>
                </div>
              </div>
              <p className="profile-pass__desc">
                Все игры, колоды, избранное и 18+ режимы — без автосписаний.
                {web
                  ? ' Покупка привязана к аккаунту на этом устройстве. Сохраните email в профиле, чтобы не потерять доступ.'
                  : ''}
              </p>
              <div className="profile-pass__perks">
                {PREMIUM_PERKS.map((perk) => (
                  <span key={perk} className="profile-pass__perk">{perk}</span>
                ))}
              </div>
              <button
                type="button"
                className="profile-pass__cta"
                onClick={() => {
                  haptic('medium')
                  if (web) navigate('/premium')
                  else setPremiumOverlayOpen(true)
                }}
              >
                <span className="profile-pass__cta-shine" aria-hidden />
                {premiumExpired ? 'Продлить Premium' : 'Получить Premium'}
              </button>
              <button
                type="button"
                className="profile-pass__restore"
                onClick={handleRestorePurchase}
                disabled={restoreLoading}
              >
                {restoreLoading ? 'Загрузка…' : 'Обновить статус Premium'}
              </button>
              {web && !tgLinked && (
                <button
                  type="button"
                  className="profile-pass__restore"
                  onClick={() => void handleLinkTelegram()}
                  disabled={restoreLoading || tgRestore?.phase === 'waiting'}
                >
                  {tgRestore?.phase === 'waiting'
                    ? 'Ожидаем подтверждение…'
                    : 'Восстановить через Telegram'}
                </button>
              )}
              {web && tgLinked && !tgRestore && (
                <>
                  <p className="profile-pass__desc profile-pass__desc--ok">
                    Telegram подключён
                    {tgLinkPremium || isPremium
                      ? '. Premium синхронизирован.'
                      : '. Premium пока не активен.'}
                  </p>
                  <button
                    type="button"
                    className="profile-pass__restore"
                    onClick={() => void handleUnlinkTelegram()}
                    disabled={restoreLoading}
                  >
                    Отвязать Telegram
                  </button>
                </>
              )}
              {tgRestorePanel}
              {!web && (
                <Link to="/link-web" className="profile-pass__restore" onClick={() => haptic('light')}>
                  Связать с сайтом
                </Link>
              )}
              {restoreStatus && (
                <span className="profile-pass__toast">{restoreStatus}</span>
              )}
            </div>
          )}
        </section>

        {web && (
          <section className="profile-pass profile-pass--email">
            <p className="profile-pass__eyebrow">Аккаунт</p>
            {savedEmail ? (
              <>
                <p className="profile-pass__desc">
                  {savedEmail}
                  <br />
                  Статус: {emailVerified ? 'Авторизован' : 'Аккаунт создан'}
                </p>
              </>
            ) : (
              <>
                <p className="profile-pass__desc">
                  Статус: Гость. Введите email и нажмите «Сохранить» — аккаунт сразу готов к работе.
                </p>
                <label className="profile-pass__email-label">
                  Ваш email
                  <input
                    type="email"
                    className="profile-pass__email-input"
                    value={emailDraft}
                    onChange={(e) => setEmailDraft(e.target.value)}
                    placeholder="name@example.com"
                    autoComplete="email"
                  />
                </label>
                <button
                  type="button"
                  className="profile-pass__cta"
                  onClick={() => void handleEmailConfirm()}
                  disabled={emailBusy || !emailDraft.trim()}
                >
                  <span className="profile-pass__cta-shine" aria-hidden />
                  {emailBusy ? 'Сохранение…' : 'Сохранить'}
                </button>
              </>
            )}
            {emailStatus && <span className="profile-pass__toast">{emailStatus}</span>}
          </section>
        )}

        <div className="profile-aside">
        {web && <ProfileFaq />}
        <section className="profile-menu">
          <h2 className="profile-menu__title">Документы</h2>
          <div className="profile-menu__panel">
            {PROFILE_DOCUMENTS.map((item) => (
              <button
                key={item.id}
                type="button"
                className="profile-menu__row"
                onClick={() => { haptic('light'); legal.openDocument(item.id) }}
              >
                <span className="profile-menu__icon" aria-hidden>📄</span>
                <span className="profile-menu__label">
                  <span className="profile-menu__label-main">{item.label}</span>
                </span>
                <span className="profile-menu__chev" aria-hidden>›</span>
              </button>
            ))}
          </div>
        </section>

        <ConsentsPanel />

        <section className="profile-menu profile-menu--support">
          <h2 className="profile-menu__title">Поддержка</h2>
          <div className="profile-menu__panel">
            {web && !isStandaloneDisplay() && (
              <button
                type="button"
                className="profile-menu__row"
                onClick={() => {
                  haptic('light')
                  openWebInstallPrompt()
                }}
              >
                <span className="profile-menu__icon" aria-hidden>📲</span>
                <span className="profile-menu__label">
                  <span className="profile-menu__label-main">Установить приложение</span>
                  <span className="profile-menu__label-sub">На главный экран телефона</span>
                </span>
                <span className="profile-menu__chev" aria-hidden>›</span>
              </button>
            )}
            <button
              type="button"
              className="profile-menu__row profile-menu__row--support"
              onClick={handleSupport}
            >
              <span className="profile-menu__icon" aria-hidden>💬</span>
              <span className="profile-menu__label">
                <span className="profile-menu__label-main">Написать в поддержку</span>
                <span className="profile-menu__label-sub">Подписка, восстановление, вопросы</span>
              </span>
              <span className="profile-menu__chev" aria-hidden>›</span>
            </button>
            {web && (
              <button
                type="button"
                className="profile-menu__row"
                onClick={() => void handleLogout()}
                disabled={logoutBusy}
              >
                <span className="profile-menu__icon" aria-hidden>⎋</span>
                <span className="profile-menu__label">
                  <span className="profile-menu__label-main">
                    {logoutBusy ? 'Выход…' : 'Выйти'}
                  </span>
                  <span className="profile-menu__label-sub">Завершить WEB-сессию</span>
                </span>
                <span className="profile-menu__chev" aria-hidden>›</span>
              </button>
            )}
          </div>
        </section>
        </div>

        {import.meta.env.DEV && userId != null && (
          <p className="profile-dev-id">id {userId}</p>
        )}
      </div>

      <PremiumOverlay isOpen={premiumOverlayOpen} onClose={() => setPremiumOverlayOpen(false)} />
    </div>
  )
}

export default Profile
