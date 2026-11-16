import { useState, useCallback, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
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
  verifyEmailBind,
} from '../lib/webAuth'
import { LIFETIME_DURATION_DAYS } from '../utils/planLabel'
import './Profile.css'

const SUPPORT_BOT_URL = 'https://t.me/GameNightHelp'

const PREMIUM_PERKS = ['8 игр', 'Избранное', '18+ режимы', 'Без автосписаний']

type TgRestorePanel = {
  code: string
  expiresAt: string
  instruction: string
  phase: 'waiting' | 'linked' | 'expired' | 'error'
  message: string | null
  activeUntil: string | null
}

function getInitials(firstName?: string, lastName?: string): string {
  const first = firstName?.trim()[0] ?? ''
  const last = lastName?.trim()[0] ?? ''
  return (first + last).toUpperCase() || '?'
}

function formatPremiumUntilLabel(activeUntil: string | null): string {
  if (!activeUntil) return 'Premium активен'
  const until = new Date(activeUntil)
  if (!Number.isFinite(until.getTime())) return 'Premium активен'
  const daysLeft = (until.getTime() - Date.now()) / 86_400_000
  if (daysLeft >= LIFETIME_DURATION_DAYS * 0.9 || until.getFullYear() >= 2090) {
    return 'Lifetime'
  }
  return `до ${until.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}`
}

function Profile() {
  const handleBack = useBack('/')
  const tgUser = getTgUser()
  const webSession = useWebSession()
  const web = isWebShell()
  const user = web
    ? webSession.session
      ? {
          first_name:
            webSession.session.displayName?.split(/\s+/)[0] ||
            (webSession.session.webAccountId ? 'Игрок' : 'Host'),
          last_name: webSession.session.displayName?.split(/\s+/).slice(1).join(' ') || undefined,
          username: webSession.session.username ?? undefined,
          photo_url: webSession.session.pictureUrl ?? undefined,
          id: webSession.session.telegramId ?? undefined,
        }
      : {
          first_name: 'Игрок',
          last_name: undefined,
          username: undefined,
          photo_url: undefined,
          id: undefined,
        }
    : tgUser
  const { isPremium, activeUntil, authError, authError401, serverError503, refreshPremium } = usePremium()
  const initData = getInitData()
  const userId = web ? webSession.session?.telegramId : (initData.userId ?? initData.user?.id)
  const webAccountId = web ? webSession.session?.webAccountId : null
  const legal = useLegal()
  const [premiumOverlayOpen, setPremiumOverlayOpen] = useState(false)
  const [restoreStatus, setRestoreStatus] = useState<string | null>(null)
  const [restoreLoading, setRestoreLoading] = useState(false)
  const [tgRestore, setTgRestore] = useState<TgRestorePanel | null>(null)
  const [tgCopyDone, setTgCopyDone] = useState(false)
  const [tgLinked, setTgLinked] = useState(false)
  const [logoutBusy, setLogoutBusy] = useState(false)
  const [emailDraft, setEmailDraft] = useState('')
  const [emailCode, setEmailCode] = useState('')
  const [emailStep, setEmailStep] = useState<'idle' | 'code'>('idle')
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
      const toast = result?.isPremium ? '✅ Покупки восстановлены' : 'Покупок не найдено'
      setRestoreStatus(toast)
    } catch {
      setRestoreStatus('Ошибка синхронизации')
    } finally {
      setRestoreLoading(false)
      restoreTimerRef.current = setTimeout(() => {
        setRestoreStatus(null)
        restoreTimerRef.current = null
      }, 2500)
    }
  }, [refreshPremium])

  const handleRestoreFromTelegram = useCallback(async () => {
    if (!web) return
    haptic('medium')
    stopTgPoll()
    setTgCopyDone(false)
    setRestoreLoading(true)
    try {
      const started = await startTelegramLinkRestore()
      if (!started.code || !started.expiresAt) {
        setTgRestore({
          code: '',
          expiresAt: '',
          instruction: started.instruction || '',
          phase: 'error',
          message: 'Сервер не вернул код привязки. Попробуйте позже.',
          activeUntil: null,
        })
        return
      }
      setTgRestore({
        code: started.code,
        expiresAt: started.expiresAt,
        instruction:
          started.instruction ||
          'Откройте GameNight Host в Telegram Mini App → «Привязать WEB» и введите код.',
        phase: 'waiting',
        message: null,
        activeUntil: null,
      })
    } catch {
      setTgRestore({
        code: '',
        expiresAt: '',
        instruction: '',
        phase: 'error',
        message: 'Не удалось начать восстановление из Telegram',
        activeUntil: null,
      })
    } finally {
      setRestoreLoading(false)
    }
  }, [web, stopTgPoll])

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

  const handleCopyTgCode = useCallback(async () => {
    if (!tgRestore?.code) return
    haptic('light')
    try {
      await navigator.clipboard.writeText(tgRestore.code)
      setTgCopyDone(true)
    } catch {
      setTgCopyDone(false)
    }
  }, [tgRestore?.code])

  useEffect(() => {
    if (!web || !tgRestore || tgRestore.phase !== 'waiting' || !tgRestore.code) {
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
                    message: 'Код истёк. Создайте новый — повторно использовать старый нельзя.',
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
          await refreshPremium()
          setTgRestore((prev) =>
            prev
              ? {
                  ...prev,
                  phase: 'linked',
                  message: status.isPremium
                    ? 'Telegram привязан. Premium восстановлен на этом WEB-аккаунте.'
                    : 'Telegram привязан. Активной Premium-подписки в Telegram не найдено.',
                  activeUntil: status.activeUntil,
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
    return () => {
      cancelled = true
      stopTgPoll()
    }
  }, [web, tgRestore?.phase, tgRestore?.code, tgRestore?.expiresAt, refreshPremium, stopTgPoll])

  useEffect(() => {
    if (!web) return
    let cancelled = false
    void fetchTelegramLinkStatus()
      .then((status) => {
        if (!cancelled) setTgLinked(Boolean(status.linked))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [web])

  useEffect(() => {
    return () => {
      if (restoreTimerRef.current) clearTimeout(restoreTimerRef.current)
      stopTgPoll()
    }
  }, [stopTgPoll])

  const handleEmailProtect = useCallback(async () => {
    if (!web || !emailDraft.trim()) return
    haptic('medium')
    setEmailBusy(true)
    setEmailStatus(null)
    try {
      if (emailStep === 'idle') {
        const started = await startEmailBind(emailDraft.trim())
        setEmailStep('code')
        setEmailStatus(
          started.code
            ? `Код отправлен (тестовый: ${started.code})`
            : 'Код отправлен на почту. Действует 10 минут.'
        )
      } else {
        await verifyEmailBind(emailDraft.trim(), emailCode.trim())
        setEmailStatus('Email подтверждён — покупки можно восстановить на другом устройстве.')
        setEmailStep('idle')
        setEmailCode('')
      }
    } catch {
      setEmailStatus('Не удалось подтвердить email. Попробуйте позже.')
    } finally {
      setEmailBusy(false)
    }
  }, [web, emailDraft, emailCode, emailStep])

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
  const activeUntilLabel = formatPremiumUntilLabel(activeUntil)
  const tgExpiresLabel = tgRestore?.expiresAt
    ? new Date(tgRestore.expiresAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    : null

  const tgRestorePanel =
    web && tgRestore ? (
      <div className="profile-pass__tg-restore" role="status" aria-live="polite">
        <p className="profile-pass__eyebrow">Восстановление из Telegram</p>
        {tgRestore.phase === 'waiting' && tgRestore.code ? (
          <>
            <p className="profile-pass__desc">{tgRestore.instruction}</p>
            <div className="profile-pass__tg-code-row">
              <code className="profile-pass__tg-code">{tgRestore.code}</code>
              <button type="button" className="profile-pass__restore" onClick={() => void handleCopyTgCode()}>
                {tgCopyDone ? 'Скопировано' : 'Копировать код'}
              </button>
            </div>
            <p className="profile-pass__desc">
              Код действует до {tgExpiresLabel || 'истечения срока'}. Ожидаем подтверждение в Mini App…
            </p>
          </>
        ) : null}
        {tgRestore.phase === 'linked' ? (
          <>
            <p className="profile-pass__desc profile-pass__desc--ok">
              {tgRestore.message || 'Привязка выполнена.'}
            </p>
            <p className="profile-pass__active-date">
              {formatPremiumUntilLabel(tgRestore.activeUntil ?? activeUntil)}
            </p>
          </>
        ) : null}
        {tgRestore.phase === 'expired' || tgRestore.phase === 'error' ? (
          <>
            <p className="profile-pass__desc">{tgRestore.message}</p>
            <button
              type="button"
              className="profile-pass__restore"
              onClick={() => void handleRestoreFromTelegram()}
              disabled={restoreLoading}
            >
              Получить новый код
            </button>
          </>
        ) : null}
      </div>
    ) : null

  return (
    <div className={`profile-page${web ? ' profile-page--web' : ''}`} aria-label="Профиль">
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
                  <p className="profile-pass__active-label">Premium</p>
                  <p className="profile-pass__active-date">{activeUntilLabel}</p>
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
              {web && (
                <button
                  type="button"
                  className="profile-pass__restore"
                  onClick={() => void handleRestoreFromTelegram()}
                  disabled={restoreLoading || tgRestore?.phase === 'waiting'}
                >
                  {tgRestore?.phase === 'waiting'
                    ? 'Ожидаем привязку…'
                    : 'Восстановить покупку из Telegram'}
                </button>
              )}
              {tgRestorePanel}
              {web && tgLinked && !tgRestore && (
                <button
                  type="button"
                  className="profile-pass__restore"
                  onClick={() => void handleUnlinkTelegram()}
                  disabled={restoreLoading}
                >
                  Отвязать Telegram
                </button>
              )}
              {!web && (
                <Link to="/link-web" className="profile-pass__restore" onClick={() => haptic('light')}>
                  Привязать WEB (код)
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
                  <p className="profile-pass__eyebrow">Premium-доступ</p>
                  <p className="profile-pass__title">Полный доступ к играм</p>
                </div>
              </div>
              <p className="profile-pass__desc">
                Все игры, колоды, избранное и 18+ режимы — без автосписаний.
                {web
                  ? ' Покупка сохраняется на этом устройстве; email для переноса — необязателен.'
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
                  setPremiumOverlayOpen(true)
                }}
              >
                <span className="profile-pass__cta-shine" aria-hidden />
                Оформить Premium
              </button>
              <button
                type="button"
                className="profile-pass__restore"
                onClick={handleRestorePurchase}
                disabled={restoreLoading}
              >
                {restoreLoading ? 'Загрузка…' : 'Обновить статус Premium'}
              </button>
              {web && (
                <button
                  type="button"
                  className="profile-pass__restore"
                  onClick={() => void handleRestoreFromTelegram()}
                  disabled={restoreLoading || tgRestore?.phase === 'waiting'}
                >
                  {tgRestore?.phase === 'waiting'
                    ? 'Ожидаем привязку…'
                    : 'Восстановить покупку из Telegram'}
                </button>
              )}
              {tgRestorePanel}
              {web && tgLinked && !tgRestore && (
                <button
                  type="button"
                  className="profile-pass__restore"
                  onClick={() => void handleUnlinkTelegram()}
                  disabled={restoreLoading}
                >
                  Отвязать Telegram
                </button>
              )}
              {!web && (
                <Link to="/link-web" className="profile-pass__restore" onClick={() => haptic('light')}>
                  Привязать WEB (код)
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
            <p className="profile-pass__eyebrow">Защита покупки</p>
            <p className="profile-pass__desc">
              Email необязателен. Без него покупка остаётся только в cookie этого устройства —
              очистка браузера может привести к потере доступа.
            </p>
            <label className="profile-pass__email-label">
              Email
              <input
                type="email"
                className="profile-pass__email-input"
                value={emailDraft}
                onChange={(e) => setEmailDraft(e.target.value)}
                placeholder="name@example.com"
                autoComplete="email"
              />
            </label>
            {emailStep === 'code' && (
              <label className="profile-pass__email-label">
                Код из письма
                <input
                  type="text"
                  inputMode="numeric"
                  className="profile-pass__email-input"
                  value={emailCode}
                  onChange={(e) => setEmailCode(e.target.value)}
                  placeholder="8 цифр"
                  maxLength={8}
                />
              </label>
            )}
            <button
              type="button"
              className="profile-pass__restore"
              onClick={() => void handleEmailProtect()}
              disabled={emailBusy || !emailDraft.trim()}
            >
              {emailBusy
                ? 'Загрузка…'
                : emailStep === 'code'
                  ? 'Подтвердить код'
                  : 'Защитить покупку — добавить email'}
            </button>
            {emailStatus && <span className="profile-pass__toast">{emailStatus}</span>}
            <p className="profile-pass__desc">
              Потеряли доступ к cookie?{' '}
              <Link to="/recover">Восстановить покупку по email</Link>
            </p>
          </section>
        )}

        <div className="profile-aside">
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
