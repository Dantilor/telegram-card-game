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
  fetchTelegramDevices,
  fetchTelegramLinkStatus,
  labelCurrentWebDevice,
  logoutCurrentWebDevice,
  startTelegramLinkRestore,
  unlinkTelegramLink,
  type WebTelegramDevice,
} from '../lib/webAuth'
import {
  formatDeviceLabelFromUa,
  isPlaceholderDeviceLabel,
  resolveDeviceDisplayLabel,
} from '../lib/deviceDisplayLabel'
import './Profile.css'
import EmailSyncStatus from '../components/EmailSyncStatus'
import { useEmailAccountSync } from '../hooks/useEmailAccountSync'
import type { EmailSyncPhase } from '../lib/emailAccountSync'
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

const TG_RESTORE_WAIT_KEY = 'gnh_tg_restore_wait_v1'

function readPersistedTgRestore(): TgRestorePanel | null {
  try {
    const raw = sessionStorage.getItem(TG_RESTORE_WAIT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as TgRestorePanel
    if (!parsed || parsed.phase !== 'waiting' || !parsed.expiresAt) return null
    if (new Date(parsed.expiresAt).getTime() <= Date.now()) {
      sessionStorage.removeItem(TG_RESTORE_WAIT_KEY)
      return {
        ...parsed,
        phase: 'expired',
        message: 'Время подключения истекло. Попробуйте ещё раз.',
      }
    }
    return parsed
  } catch {
    return null
  }
}

function persistTgRestore(panel: TgRestorePanel | null): void {
  try {
    if (panel?.phase === 'waiting') {
      sessionStorage.setItem(TG_RESTORE_WAIT_KEY, JSON.stringify(panel))
    } else {
      sessionStorage.removeItem(TG_RESTORE_WAIT_KEY)
    }
  } catch {
    /* ignore */
  }
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
  const [tgRestore, setTgRestore] = useState<TgRestorePanel | null>(() =>
    isWebShell() ? readPersistedTgRestore() : null
  )
  const [tgLinked, setTgLinked] = useState(false)
  const [tgLinkPremium, setTgLinkPremium] = useState(false)
  const [logoutBusy, setLogoutBusy] = useState(false)
  const [devices, setDevices] = useState<WebTelegramDevice[]>([])
  const [devicesUsed, setDevicesUsed] = useState(0)
  const [devicesLimit, setDevicesLimit] = useState(3)
  const [devicesBusy, setDevicesBusy] = useState(false)
  const [devicesError, setDevicesError] = useState<string | null>(null)
  const [emailDraft, setEmailDraft] = useState('')
  const [emailStatus, setEmailStatus] = useState<string | null>(null)
  const emailSync = useEmailAccountSync({
    session: webSession.session,
    refreshSession: webSession.refreshSession,
    refreshPremium,
    startEmailPendingWatch: webSession.startEmailPendingWatch,
    stopEmailPendingWatch: webSession.stopEmailPendingWatch,
  })
  const emailBusy = emailSync.busy
  const { announce: announceEmailSync, save: saveEmailSync } = emailSync
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
    // iOS Safari/PWA: about:blank openers stay white and never navigate to t.me.
    // Prefer same-window deep link there; on desktop keep a sync popup gesture.
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : ''
    const iosLike =
      /iPad|iPhone|iPod/.test(ua) ||
      (typeof navigator !== 'undefined' &&
        navigator.platform === 'MacIntel' &&
        navigator.maxTouchPoints > 1)
    const sameWindowOpen = iosLike || isStandaloneDisplay()
    let opener: Window | null = null
    if (!sameWindowOpen) {
      try {
        opener = window.open('about:blank', '_blank')
      } catch {
        opener = null
      }
    }
    const openDeepLink = (deepLink: string) => {
      // Prefer a real navigation to t.me — most reliable on iOS Safari/PWA.
      if (sameWindowOpen) {
        window.location.assign(deepLink)
        return
      }
      if (opener && !opener.closed) {
        try {
          opener.location.replace(deepLink)
          return
        } catch {
          try {
            opener.close()
          } catch {
            /* ignore */
          }
        }
      }
      try {
        const anchor = document.createElement('a')
        anchor.href = deepLink
        anchor.target = '_blank'
        anchor.rel = 'noopener noreferrer'
        anchor.style.display = 'none'
        document.body.appendChild(anchor)
        anchor.click()
        anchor.remove()
        return
      } catch {
        /* fall through */
      }
      window.location.assign(deepLink)
    }
    const closeOpener = () => {
      if (opener && !opener.closed) {
        try {
          opener.close()
        } catch {
          /* ignore */
        }
      }
    }
    try {
      // Already linked → just refresh Premium, no new challenge.
      const current = await fetchTelegramLinkStatus().catch(() => null)
      if (current?.linked) {
        closeOpener()
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

      const started = await startTelegramLinkRestore(formatDeviceLabelFromUa())
      if (!started.deepLink || !started.expiresAt) {
        closeOpener()
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
          'Откроется Telegram Mini App GameNight Host. Подтвердите привязку одним нажатием, затем вернитесь на сайт — Premium подтянется автоматически.',
        phase: 'waiting',
        message: 'Ожидаем подключение Telegram… Вернитесь сюда после подтверждения в Mini App.',
        activeUntil: null,
        isPremium: null,
      })
      openDeepLink(started.deepLink)
    } catch (reason) {
      closeOpener()
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
    persistTgRestore(tgRestore)
  }, [tgRestore])

  useEffect(() => {
    if (!web || !tgRestore || tgRestore.phase !== 'waiting') {
      stopTgPoll()
      return
    }
    let cancelled = false
    let missingPendingTicks = 0
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
        if (status.lastErrorCode === 'device_limit_reached') {
          stopTgPoll()
          setTgRestore((prev) =>
            prev
              ? {
                  ...prev,
                  phase: 'error',
                  message:
                    'Все 3 устройства уже подключены. Откройте Telegram Mini App GameNight Host (управление устройствами), отключите одно и повторите восстановление.',
                }
              : prev
          )
          return
        }
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
          return
        }
        // Challenge gone without a link → Mini App never completed (lost startapp / error).
        if (!status.pendingChallengeExpiresAt) {
          missingPendingTicks += 1
          if (missingPendingTicks >= 3) {
            stopTgPoll()
            setTgRestore((prev) =>
              prev
                ? {
                    ...prev,
                    phase: 'error',
                    message:
                      'Подтверждение в Telegram не завершилось. Откройте ссылку снова и дождитесь экрана «Восстановить Premium», либо нажмите «Восстановить через Telegram» ещё раз.',
                  }
                : prev
            )
          }
        } else {
          missingPendingTicks = 0
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
    const state = location.state as { emailAuthToast?: string; emailSyncPhase?: EmailSyncPhase } | null
    if (!state?.emailAuthToast && !state?.emailSyncPhase) return
    if (state.emailSyncPhase) announceEmailSync(state.emailSyncPhase)
    else if (state.emailAuthToast) setEmailStatus(state.emailAuthToast)
    navigate(location.pathname, { replace: true, state: null })
  }, [location.state, location.pathname, navigate, announceEmailSync])

  useEffect(() => {
    return () => {
      if (restoreTimerRef.current) clearTimeout(restoreTimerRef.current)
      stopTgPoll()
    }
  }, [stopTgPoll])

  const savedEmail = webSession.session?.email?.trim() || ''
  const emailVerified = Boolean(webSession.session?.emailVerified)
  const receiptEmail = web ? webSession.session?.receiptEmail?.trim() || '' : ''
  // A completed WEB checkout already saved this email on the payment.
  // It is visible in Profile without making the payer type or save it twice.
  const profileEmail = savedEmail || receiptEmail
  // Prefill from the saved checkout email so no second typing is required.
  useEffect(() => {
    if (!profileEmail) return
    setEmailDraft((draft) => draft || profileEmail)
  }, [profileEmail])

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
    const target = (emailDraft || profileEmail).trim()
    if (!target) return
    haptic('medium')
    setEmailStatus(null)
    await saveEmailSync(target)
  }, [web, profileEmail, emailDraft, saveEmailSync])
  const handleSupport = useCallback(() => {
    haptic('light')
    const tg = getTelegramWebApp()
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(SUPPORT_BOT_URL)
    } else {
      window.open(SUPPORT_BOT_URL, '_blank', 'noopener,noreferrer')
    }
  }, [])

  const refreshDevices = useCallback(async () => {
    if (!web || !tgLinked) {
      setDevices([])
      setDevicesUsed(0)
      return
    }
    setDevicesBusy(true)
    try {
      const listed = await fetchTelegramDevices()
      let next = listed.devices || []
      const current = next.find((d) => d.isCurrent)
      if (current && isPlaceholderDeviceLabel(current.label)) {
        const friendly = formatDeviceLabelFromUa()
        try {
          await labelCurrentWebDevice(friendly)
          next = next.map((d) => (d.id === current.id ? { ...d, label: friendly } : d))
        } catch {
          next = next.map((d) =>
            d.id === current.id
              ? { ...d, label: resolveDeviceDisplayLabel(d.label, { isCurrent: true }) }
              : d
          )
        }
      } else {
        next = next.map((d) => ({
          ...d,
          label: resolveDeviceDisplayLabel(d.label, { isCurrent: d.isCurrent }),
        }))
      }
      setDevices(next)
      setDevicesUsed(listed.devicesUsed ?? next.length)
      setDevicesLimit(listed.devicesLimit ?? 3)
      setDevicesError(null)
    } catch {
      setDevicesError('Не удалось загрузить список устройств')
    } finally {
      setDevicesBusy(false)
    }
  }, [web, tgLinked])

  useEffect(() => {
    if (!web || !tgLinked) return
    void refreshDevices()
  }, [web, tgLinked, refreshDevices])

  const handleLogout = useCallback(async () => {
    if (!web) return
    haptic('light')
    const canSignInAgain = Boolean(webSession.session?.emailVerified || tgLinked)
    const message = !canSignInAgain
      ? 'Выйти из гостевого сеанса? Если у вас есть Premium, сначала сохраните доступ к аккаунту: после выхода его может быть сложно вернуть.'
      : tgLinked
        ? 'Выйти на этом устройстве? Слот Telegram Premium освободится.'
        : 'Выйти из аккаунта на этом устройстве?'
    if (!window.confirm(message)) return
    setLogoutBusy(true)
    setDevicesError(null)
    try {
      if (tgLinked) await logoutCurrentWebDevice()
      else await webSession.logout()
      window.location.assign('/')
    } catch {
      setDevicesError('Не удалось выйти на этом устройстве. Попробуйте ещё раз.')
    } finally {
      setLogoutBusy(false)
    }
  }, [web, tgLinked, webSession])

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
            {profileEmail ? (
              <>
                <p className="profile-pass__desc">
                  {profileEmail}
                  <br />
                  Статус: {emailVerified ? 'Авторизован' : 'Email сохранён'}
                </p>
                {!emailVerified && (
                  <>
                    <p className="profile-pass__desc">
                      {isPremium
                        ? 'Premium активен в этом аккаунте. Дополнительно подтверждать почту для игры не нужно.'
                        : 'Если Premium куплен на эту почту в другом браузере, нажмите ниже. Мы отправим ссылку для безопасного восстановления.'}
                    </p>
                    <label className="profile-pass__email-label">
                      Email для аккаунта
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
                      {emailBusy ? 'Проверяем…' : emailSync.phase === 'confirm' ? 'Отправить ссылку ещё раз' : isPremium ? 'Сохранить email' : 'Проверить Premium'}
                    </button>
                  </>
                )}
              </>
            ) : (
              <>
                <p className="profile-pass__desc">
                  Статус: Гость. Введите email. Если Premium уже куплен здесь, он останется
                  активным без письма. Если покупка была на другом устройстве, пришлём ссылку автоматически.
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
                  {emailBusy ? 'Проверяем…' : emailSync.phase === 'confirm' ? 'Отправить ссылку ещё раз' : 'Сохранить и проверить Premium'}
                </button>
              </>
            )}
            <EmailSyncStatus phase={emailSync.phase} error={emailSync.error} email={emailSync.pendingEmail} />
            {emailStatus && emailSync.phase === 'idle' && <span className="profile-pass__toast">{emailStatus}</span>}
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

        {web && (
          <section className="profile-menu" aria-label="Сеанс" data-testid="profile-signout">
            <h2 className="profile-menu__title">Сеанс на этом устройстве</h2>
            <div className="profile-menu__panel">
              <button
                type="button"
                className="profile-menu__row"
                disabled={logoutBusy}
                onClick={() => void handleLogout()}
              >
                <span className="profile-menu__icon" aria-hidden>🚪</span>
                <span className="profile-menu__label">
                  <span className="profile-menu__label-main">{logoutBusy ? 'Выходим…' : 'Выйти из аккаунта'}</span>
                </span>
                <span className="profile-menu__chev" aria-hidden>›</span>
              </button>
            </div>
            {devicesError && <p className="profile-pass__desc" role="alert">{devicesError}</p>}
          </section>
        )}

        {web && tgLinked ? (
          <section className="profile-menu profile-devices" aria-label="Мои устройства" data-testid="profile-devices">
            <h2 className="profile-menu__title">Мои устройства</h2>
            <p className="profile-pass__desc">
              Подключено: {devicesUsed} из {devicesLimit}
            </p>
            {devicesError ? <p className="profile-pass__desc">{devicesError}</p> : null}
            <div className="profile-menu__panel">
              {devices.length === 0 && !devicesBusy ? (
                <p className="profile-pass__desc">Пока нет зарегистрированных устройств.</p>
              ) : null}
              {devices.map((device) => (
                <div key={device.id} className="profile-menu__row profile-devices__row">
                  <span className="profile-menu__icon" aria-hidden>
                    {device.isCurrent ? '●' : '○'}
                  </span>
                  <span className="profile-menu__label">
                    <span className="profile-menu__label-main">
                      {resolveDeviceDisplayLabel(device.label, { isCurrent: device.isCurrent })}
                    </span>
                    <span className="profile-menu__label-sub">
                      {device.isCurrent
                        ? 'Это устройство'
                        : `Активность: ${new Date(device.lastActiveAt).toLocaleDateString('ru-RU')}`}
                    </span>
                  </span>
                  {!device.isCurrent && (
                    <button
                      type="button"
                      className="profile-devices__action profile-devices__action--ghost"
                      disabled={devicesBusy || logoutBusy}
                      onClick={() => {
                        haptic('light')
                        const shown = resolveDeviceDisplayLabel(device.label, { isCurrent: false })
                        const ok = window.confirm(
                          `Отключить «${shown}»? Подтверждение откроется в Telegram.`
                        )
                        if (!ok) return
                        const tg = getTelegramWebApp()
                        const url = 'https://t.me/GameNightHostBot?startapp=devices'
                        if (tg?.openTelegramLink) tg.openTelegramLink(url)
                        else window.open(url, '_blank', 'noopener,noreferrer')
                      }}
                    >
                      Отключить
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        ) : null}

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
