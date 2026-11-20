import { useEffect, useState, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { haptic } from '../utils/telegram'
import { getTelegramWebApp, ensureInitData } from '../lib/telegram'
import { isWebShell } from '../config/shell'
import { useLegal } from '../legal/LegalProvider'
import { classifyReceipt, LegalClientError, submitNewPremiumOrder, userFacingLoadError } from '../legal/client'
import type { PublicDocument } from '../legal/types'
import { invalidateDocument, loadDocument } from '../legal/documentCache'
import { trackEvent } from '../lib/analytics'
import { apiGet } from '../lib/api'
import { usePremium } from '../contexts/PremiumContext'
import { useWebSession } from '../shell/WebSessionContext'
import { useTheme } from '../hooks/useTheme'
import { useRecoveringResource } from '../hooks/useRecoveringResource'
import {
  DEFAULT_PLAN_ID,
  checkoutPlanCopy,
  formatPlanPeriod,
  formatPlanPriceLabel,
  isLifetimePlan,
  type PlanOption,
} from '../utils/planLabel'
import gemNeon from '../assets/optimized/premium-gem-neon.webp'
import gemLight from '../assets/optimized/premium-gem-light.webp'
import gemSunset from '../assets/optimized/premium-gem-sunset.webp'
import gemCalm from '../assets/optimized/premium-gem-calm.webp'
import crystalUrl from '../pages/gnh-inside/assets/reference-crystal.webp'
import iconCheckCircle from '../assets/icons/premium-modal/check-circle.svg'
import iconCloseX from '../assets/icons/premium-modal/close-x.svg'
import iconRestorePurchases from '../assets/icons/premium-modal/restore-purchases.svg'
import iconLockSecure from '../assets/icons/premium-modal/lock-secure.svg'
import iconSparkle from '../assets/icons/premium-modal/sparkle.svg'
import './PremiumOverlay.css'

const GEMS_BY_THEME = {
  'neon-dark': gemNeon,
  'neon-light': gemLight,
  sunset: gemSunset,
  'minimal-calm': gemCalm,
} as const

const PREMIUM_INCLUDES = [
  {
    title: 'Все вопросы без лимитов',
    text: 'Полный доступ ко всем колодам для пар, свиданий, друзей, компаний и 18+.',
  },
  {
    title: 'Закрытые Premium-режимы',
    text: 'Более глубокие, смешные и неожиданные вопросы, которые сильнее раскачивают разговор.',
  },
  {
    title: 'Комикс-истории с героями GNH',
    text: 'Сюжетные режимы, где вечер превращается не просто в карточки, а в мини-историю с героями, ситуациями и выбором.',
  },
  {
    title: 'Персональные сценарии под вечер',
    text: 'Для свидания, вечеринки, подруг, пары, компании или 18+ формата — GNH подбирает настроение игры под вас.',
  },
  {
    title: 'Новые игры сразу после выхода',
    text: 'Все свежие режимы, обновления и закрытые подборки будут доступны без отдельной покупки.',
  },
  {
    title: 'Избранное и быстрый доступ',
    text: 'Сохраняй самые сильные вопросы, чтобы возвращаться к ним в нужный момент.',
  },
] as const

function Mark({ children }: { children: ReactNode }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      {children}
    </svg>
  )
}

function planNote(plan: PlanOption): string {
  if (isLifetimePlan(plan.id, plan.durationDays)) return 'Один раз — без ограничений'
  if (plan.durationDays > 31) {
    const months = Math.max(1, Math.round(plan.durationDays / 30))
    return `${Math.max(1, Math.round(plan.priceRub / months))} ₽ в месяц`
  }
  return 'Для ближайших вечеров'
}

const POLL_INTERVAL_MS = 2000
const POLL_ATTEMPTS = 15

function pollPremiumStatus(
  refresh: () => void,
  onBecamePremium?: () => void
): () => void {
  let cancelled = false
  const cancel = () => {
    cancelled = true
  }
  const run = async () => {
    for (let i = 0; i < POLL_ATTEMPTS && !cancelled; i++) {
      await new Promise((r) => setTimeout(r, i === 0 ? 0 : POLL_INTERVAL_MS))
      if (cancelled) return
      try {
        const me = await apiGet<{ premium?: boolean }>('/api/me')
        if (me.premium) {
          refresh()
          onBecamePremium?.()
          return
        }
      } catch {
        // ignore
      }
    }
  }
  run()
  return cancel
}

async function loadPlans(signal: AbortSignal): Promise<PlanOption[]> {
  const path = isWebShell() ? '/api/plans?audience=web' : '/api/plans'
  const res = await apiGet<{ ok?: boolean; plans?: PlanOption[] }>(path, { signal })
  if (res.ok && Array.isArray(res.plans) && res.plans.length > 0) return res.plans
  // An empty catalog is a server-side condition; keep recovering instead of inventing plans.
  throw Object.assign(new Error('plans_unavailable'), { status: 503 })
}

function loadOffer(): Promise<PublicDocument> {
  return loadDocument('offer')
}

const PAGE_PERKS = [
  'Все игры, колоды и 18+ режимы',
  'Избранное и комикс-истории',
  'Новые режимы без отдельной покупки',
  'Без автопродления',
] as const

function offerStatementText(
  document: PublicDocument | null | undefined,
  status: string
): string | null {
  if (document?.confirmation.available === true && document.confirmation.mode === 'statement') {
    return document.confirmation.statement
  }
  if (status === 'loading') return 'Загрузка текста оферты…'
  return null
}

function CatalogNotice({
  plans,
  offer,
}: {
  plans: { status: string; error: unknown; retryNow: () => void }
  offer: { status: string; error: unknown; retryNow: () => void }
}) {
  const reconnecting = plans.status === 'recovering' || offer.status === 'recovering'
  const plansLoading = plans.status === 'idle' || plans.status === 'loading'
  const show =
    reconnecting ||
    plans.status === 'failed' ||
    offer.status === 'failed' ||
    plansLoading
  if (!show) return null
  return (
    <div className="premium-catalog-status">
      {reconnecting && (
        <p className="premium-overlay__plans-loading" role="status">
          Восстанавливаем соединение…
        </p>
      )}
      {plans.status === 'recovering' && (
        <button type="button" className="premium-overlay__legal-link" onClick={plans.retryNow}>
          Повторить тарифы
        </button>
      )}
      {offer.status === 'recovering' && (
        <button type="button" className="premium-overlay__legal-link" onClick={offer.retryNow}>
          Повторить оферту
        </button>
      )}
      {plans.status === 'failed' && (
        <p className="premium-overlay__error" role="alert">
          {userFacingLoadError(plans.error)}{' '}
          <button type="button" className="premium-overlay__legal-link" onClick={plans.retryNow}>
            Повторить загрузку тарифов
          </button>
        </p>
      )}
      {offer.status === 'failed' && (
        <p className="premium-offer__error" role="alert">
          {userFacingLoadError(offer.error)}{' '}
          <button type="button" className="premium-overlay__legal-link" onClick={offer.retryNow}>
            Повторить загрузку оферты
          </button>
        </p>
      )}
      {!reconnecting && plansLoading && !plans.error && plans.status !== 'failed' && (
        <p className="premium-overlay__plans-loading" role="status">Загрузка тарифов…</p>
      )}
    </div>
  )
}

type Props = {
  isOpen: boolean
  onClose: () => void
  onBuyPremium?: () => void
  /** Режим страницы: без оверлея, с кнопкой «Назад» */
  asPage?: boolean
  /** Prefill / lock selection to a real plan id from /api/plans. */
  preferredPlanId?: string
  /** Optional snapshot so WEB checkout can render before catalog reload. */
  preferredPlan?: Pick<PlanOption, 'id' | 'title' | 'priceRub' | 'durationDays'>
  /** Compact checkout: skip marketing blocks (WEB tariff gate). */
  checkoutOnly?: boolean
  /** Return to plan picker without losing payment context. */
  onChangePlan?: () => void
  /** Leave checkout / Premium flow and return to the site home. */
  onGoHome?: () => void
  onBecamePremium?: () => void
}

export default function PremiumOverlay({
  isOpen,
  onClose,
  onBuyPremium,
  asPage,
  preferredPlanId,
  preferredPlan,
  checkoutOnly,
  onChangePlan,
  onGoHome,
  onBecamePremium,
}: Props) {
  const location = useLocation()
  const navigate = useNavigate()
  const { refresh } = usePremium()
  const insideWeb =
    isWebShell() && location.pathname !== '/' && location.pathname !== '/login'
  const legal = useLegal()
  const webSession = useWebSession()
  const [theme] = useTheme()
  const gem = isWebShell() ? gemNeon : GEMS_BY_THEME[theme]
  const [offerChecked, setOfferChecked] = useState(false)
  const [bindAccountEmail, setBindAccountEmail] = useState(false)
  const [receipt, setReceipt] = useState('')
  const [selectedPlanId, setSelectedPlanId] = useState<string>(preferredPlanId || DEFAULT_PLAN_ID)
  const [loading, setLoading] = useState(false)
  const [restoreLoading, setRestoreLoading] = useState(false)
  const [restoreToast, setRestoreToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [offerAttempt, setOfferAttempt] = useState(0)
  const pollAbortRef = useRef<(() => void) | null>(null)

  // WEB: never show the legacy marketing modal — kit plans page + checkoutOnly overlay only.
  useEffect(() => {
    if (!isOpen || !isWebShell() || checkoutOnly || asPage) return
    if (location.pathname.startsWith('/premium')) return
    const params = new URLSearchParams({ focus: 'plans' })
    navigate(`/premium?${params.toString()}`)
    onClose()
  }, [asPage, checkoutOnly, isOpen, location.pathname, navigate, onClose])

  // Plans and the offer recover independently while the Premium screen is open.
  const plansResource = useRecoveringResource(isOpen, loadPlans)
  const offerResource = useRecoveringResource(isOpen, loadOffer, offerAttempt)
  const plans = plansResource.data ?? []
  const plansLoading = plansResource.status !== 'ready'
  const offerDocument = offerResource.data
  const offerLoading = offerResource.status === 'loading' || offerResource.status === 'recovering'
  const offerError = offerResource.status === 'failed' ? userFacingLoadError(offerResource.error) : null

  const savedReceipt =
    webSession.session?.emailVerified && webSession.session.email ? webSession.session.email : ''

  // Prefill the receipt from the account email. A typed value is kept across retries.
  useEffect(() => {
    if (!isOpen || !savedReceipt) return
    setReceipt((current) => current || savedReceipt)
  }, [isOpen, savedReceipt])

  // Each document (re)load requires the user to review and accept its version.
  useEffect(() => {
    setOfferChecked(false)
    setBindAccountEmail(false)
  }, [isOpen, offerDocument])

  const accountVerified = Boolean(webSession.session?.emailVerified && webSession.session?.email)
  const accountEmail = webSession.session?.email?.trim() || ''
  const receiptMatchesVerified =
    accountVerified && receipt.trim().toLowerCase() === accountEmail.toLowerCase()

  useEffect(() => {
    if (preferredPlanId) setSelectedPlanId(preferredPlanId)
  }, [preferredPlanId, isOpen])

  useEffect(() => {
    const loaded = plansResource.data
    if (!loaded?.length) return
    if (preferredPlanId && loaded.some((p) => p.id === preferredPlanId)) {
      setSelectedPlanId(preferredPlanId)
      return
    }
    if (checkoutOnly && preferredPlanId) {
      // Keep the chosen WEB plan id even while the catalog is still catching up.
      setSelectedPlanId(preferredPlanId)
      return
    }
    const webDefault = loaded.find((p) => p.id.includes('web_3m') || p.durationDays === 90)
    const fallback =
      (webDefault && webDefault.id) ||
      (loaded.some((p) => p.id === DEFAULT_PLAN_ID) ? DEFAULT_PLAN_ID : loaded[0].id)
    setSelectedPlanId(fallback)
  }, [checkoutOnly, plansResource.data, preferredPlanId])

  const selectedPlan =
    plans.find((p) => p.id === selectedPlanId) ||
    (preferredPlanId ? plans.find((p) => p.id === preferredPlanId) : undefined) ||
    (preferredPlan && preferredPlan.id === (preferredPlanId || selectedPlanId) ? preferredPlan : undefined) ||
    (preferredPlan && checkoutOnly ? preferredPlan : undefined) ||
    (!checkoutOnly ? plans[0] : undefined) ||
    null

  const handleRestorePurchase = async () => {
    haptic('medium')
    setRestoreToast(null)
    setRestoreLoading(true)
    try {
      const result = await refresh()
      if (result?.isPremium) {
        setRestoreToast('✅ Покупки восстановлены')
        setSuccess(true)
        setError(null)
        setTimeout(() => {
          onClose()
          setSuccess(false)
        }, 1500)
        return
      }
      if (isWebShell()) {
        // Cookie/session miss: email magic-link login restores the same WEB account.
        onClose()
        navigate('/login')
        return
      }
      setRestoreToast('Покупок не найдено')
    } catch {
      setRestoreToast('Ошибка синхронизации')
    } finally {
      setRestoreLoading(false)
      setTimeout(() => setRestoreToast(null), 2500)
    }
  }

  useEffect(() => {
    if (isOpen && !asPage) {
      trackEvent('click_premium')
      const handleEsc = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose()
      }
      document.addEventListener('keydown', handleEsc)
      document.body.style.overflow = 'hidden'
      return () => {
        document.removeEventListener('keydown', handleEsc)
        document.body.style.overflow = ''
      }
    }
    if (isOpen && asPage) {
      trackEvent('click_premium')
    }
  }, [isOpen, onClose, asPage])

  useEffect(() => {
    if (!isOpen) {
      pollAbortRef.current?.()
      pollAbortRef.current = null
    }
  }, [isOpen])

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      haptic('light')
      onClose()
    }
  }

  const handleBuyPremium = async () => {
    haptic('medium')
    if (onBuyPremium) {
      onBuyPremium()
      return
    }

    const plan = selectedPlan
    if (!plan) {
      setError('Нет доступных тарифов')
      return
    }

    if (!offerChecked || !offerDocument) {
      setError('Отметьте принятие действующей оферты. Заказ не создан.')
      return
    }
    const receiptEmail = receipt.trim()
    if (!receiptEmail) {
      setError('Для чека укажите email.')
      return
    }

    setError(null)
    setLoading(true)
    try {
      if (!isWebShell()) {
        const initData = await ensureInitData()
        if (!initData) {
          setError('Откройте приложение внутри Telegram для оплаты')
          return
        }
      }
      const res = await submitNewPremiumOrder({
        document: offerDocument,
        plan: {
          id: plan.id,
          title: plan.title,
          priceRub: plan.priceRub,
          durationDays: plan.durationDays,
        },
        receiptRaw: receiptEmail,
        bindAccountEmail:
          isWebShell() &&
          bindAccountEmail &&
          !receiptMatchesVerified &&
          !(accountVerified && receipt.trim().toLowerCase() !== accountEmail.toLowerCase()),
        post: (path, body) => legal.postLegal(path, body),
      })
      const url = res.confirmationUrl
      if (!url) {
        setError('Не удалось создать платёж')
        return
      }
      trackEvent('yookassa_redirect')
      try {
        sessionStorage.setItem('tcg_expecting_payment', String(Date.now()))
      } catch { /* ignore */ }

      const tg = getTelegramWebApp()
      if (!isWebShell() && tg?.openLink) {
        tg.openLink(url)
      } else {
        window.location.assign(url)
      }
      pollAbortRef.current?.()
      pollAbortRef.current = pollPremiumStatus(refresh, () => {
        setSuccess(true)
        setError(null)
        onBecamePremium?.()
        setTimeout(() => {
          onClose()
          setSuccess(false)
        }, 1500)
      })
    } catch (e) {
      if (e instanceof LegalClientError && e.code === 'version_mismatch') {
        setOfferChecked(false)
        invalidateDocument('offer')
        setOfferAttempt((value) => value + 1)
      }
      if (e instanceof LegalClientError) {
        setError(userFacingLoadError(e))
      } else {
        const err = e as Error & { status?: number }
        if (err.status === 401) setError('Откройте приложение внутри Telegram для оплаты')
        else if (err.status === 502) setError('Платёжный сервис сейчас недоступен. Попробуйте ещё раз чуть позже.')
        else setError('Не удалось создать платёж. Принятие оферты не подтверждено.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen && !asPage) return null

  // WEB: never paint the legacy marketing modal — redirect effect sends users to /premium.
  if (isWebShell() && !checkoutOnly && !asPage) return null

  const receiptEmail = receipt.trim()
  const receiptCheck = receiptEmail ? classifyReceipt(receiptEmail) : null
  const receiptError = receiptCheck && 'error' in receiptCheck ? receiptCheck.error : null
  const canStartPayment = Boolean(
    selectedPlan &&
      offerDocument &&
      offerChecked &&
      receiptCheck &&
      !receiptError &&
      !offerError &&
      !offerLoading &&
      (checkoutOnly || !plansLoading)
  )
  const buyLabel = selectedPlan
    ? checkoutOnly
      ? `Оплатить Premium · ${selectedPlan.priceRub} ₽`
      : `Открыть Premium · ${formatPlanPriceLabel(selectedPlan)}`
    : checkoutOnly
      ? 'Оплатить Premium'
      : 'Открыть Premium'
  const checkoutCopy = selectedPlan ? checkoutPlanCopy(selectedPlan) : null

  if (asPage && insideWeb) {
    const offerStatement =
      offerDocument?.confirmation.available === true && offerDocument.confirmation.mode === 'statement'
        ? offerDocument.confirmation.statement
        : null
    return (
      <div className="premium-screen">
        <div className="page-top">
          <div className="breadcrumb">
            <Link to="/">
              <Mark>
                <path d="m3 10 9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V10Z" />
              </Mark>
              Домой
            </Link>
            <Mark>
              <path d="m9 5 7 7-7 7" />
            </Mark>
            <span>Premium-доступ</span>
          </div>
          <button type="button" className="ghost-link" onClick={onClose}>
            <Mark>
              <path d="m9 5 7 7-7 7" />
            </Mark>
            Назад
          </button>
        </div>
        <div className="premium-layout">
          <section>
            <div className="premium-heading">
              <img className="crystal" src={crystalUrl} alt="" width={120} height={120} />
              <div>
                <span className="eyebrow">
                  <Mark>
                    <path d="m12 3 2.7 6.3L21 12l-6.3 2.7L12 21l-2.7-6.3L3 12l6.3-2.7L12 3Z" />
                  </Mark>
                  GAMENIGHT PREMIUM
                </span>
                <h1 className="page-title" id="premium-overlay-title">Premium-доступ</h1>
                <p className="lead">Полный доступ для ведущего. Компания играет вместе.</p>
              </div>
            </div>
            <div className="glass benefit-card">
              <h2>
                <Mark>
                  <path d="m12 3 2.7 6.3L21 12l-6.3 2.7L12 21l-2.7-6.3L3 12l6.3-2.7L12 3Z" />
                </Mark>
                Что входит
              </h2>
              <ul className="premium-perks">
                {PAGE_PERKS.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="premium-note">
              <Mark>
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
              </Mark>
              <span>Premium нужен только ведущему.</span>
            </div>
          </section>
          <aside className="glass plans-panel">
            <h2>Выберите срок</h2>
            <p>Цена приходит с сервера. Без автопродления.</p>
            {success && <p className="premium-overlay__success">Premium активирован</p>}
            {error && <p className="premium-overlay__error" role="alert">{error}</p>}
            {restoreToast && <p className="premium-overlay__toast" role="status">{restoreToast}</p>}
            <CatalogNotice plans={plansResource} offer={offerResource} />
            {plansResource.status === 'ready' && (
              <fieldset className="plans" aria-label="Тариф Premium">
                {plans.map((plan) => (
                  <label className="plan" key={plan.id}>
                    <input
                      type="radio"
                      name="premium-plan"
                      value={plan.id}
                      checked={plan.id === selectedPlanId}
                      onChange={() => {
                        haptic('light')
                        setSelectedPlanId(plan.id)
                      }}
                    />
                    <span>
                      <span className="plan-title">{plan.title || formatPlanPeriod(plan.durationDays)}</span>
                      <span className="plan-note">{planNote(plan)}</span>
                    </span>
                    <strong className="plan-price">{plan.priceRub} ₽</strong>
                    {plan.id === DEFAULT_PLAN_ID && <span className="plan-badge">ВЫГОДНЫЙ ВЫБОР</span>}
                  </label>
                ))}
              </fieldset>
            )}
            <label className="field">
              Email для чека
              <input
                type="email"
                value={receipt}
                placeholder="name@example.com"
                autoComplete="email"
                inputMode="email"
                aria-invalid={receiptError ? true : undefined}
                onChange={(event) => setReceipt(event.target.value)}
              />
            </label>
            {receiptError && <p className="premium-offer__error" role="alert">{receiptError}</p>}
            <label className="consent">
              <input
                id="consent"
                type="checkbox"
                checked={offerChecked}
                disabled={offerLoading || !offerStatement}
                onChange={(event) => setOfferChecked(event.target.checked)}
              />
              <span>
                {offerStatement ?? offerStatementText(offerDocument, offerResource.status) ?? 'Текст оферты ещё не загружен'}
                <span className="consent-links">
                  <button type="button" onClick={() => { haptic('light'); legal.openDocument('offer') }}>
                    условия оферты
                  </button>
                  {' и '}
                  <button type="button" onClick={() => { haptic('light'); legal.openDocument('privacy') }}>
                    политику конфиденциальности
                  </button>
                </span>
              </span>
            </label>
            <button
              type="button"
              className="button button-primary premium-pay"
              onClick={handleBuyPremium}
              disabled={loading || !canStartPayment}
              aria-busy={loading}
            >
              <Mark>
                <path d="m3 8 4-5h10l4 5-9 13L3 8Z" />
                <path d="M3 8h18M7 3l5 18 5-18" />
              </Mark>
              {loading ? 'Создаём оплату…' : buyLabel}
            </button>
            <p className="quiet-note">Без автопродления. Продлевать доступ решаете только вы.</p>
            <button
              type="button"
              className="text-button restore-link"
              onClick={handleRestorePurchase}
              disabled={restoreLoading}
              aria-busy={restoreLoading}
            >
              {restoreLoading
                ? 'Проверяем покупки…'
                : isWebShell()
                  ? 'Войти по email'
                  : 'Восстановить покупки'}
            </button>
          </aside>
        </div>
      </div>
    )
  }

  const offerBlock = (
    <div className={`premium-offer${checkoutOnly ? ' premium-offer--checkout' : ''}`}>
      {!checkoutOnly && selectedPlan && (
        <p className="premium-offer__summary">
          {selectedPlan.title}: {selectedPlan.priceRub} ₽, {formatPlanPeriod(selectedPlan.durationDays)}. Автопродления нет.
        </p>
      )}
      {checkoutOnly ? <CatalogNotice plans={plansResource} offer={offerResource} /> : null}
      <button type="button" className="premium-overlay__legal-link" onClick={() => { haptic('light'); legal.openDocument('offer') }}>
        Публичная оферта
      </button>
      <label className={`legal-choice__check${checkoutOnly ? ' legal-choice__check--gnh' : ''}`}>
        <input
          type="checkbox"
          checked={offerChecked}
          disabled={
            offerLoading ||
            !offerDocument ||
            offerDocument.confirmation.available !== true ||
            offerDocument.confirmation.mode !== 'statement'
          }
          onChange={(event) => setOfferChecked(event.target.checked)}
        />
        <span>
          {offerStatementText(offerDocument, offerResource.status) ?? 'Текст оферты ещё не загружен'}
        </span>
      </label>
      <label className="premium-offer__field">
        <span>Email для кассового чека</span>
        <input
          type="email"
          value={receipt}
          placeholder="name@example.com"
          autoComplete="email"
          inputMode="email"
          aria-invalid={receiptError ? true : undefined}
          onChange={(event) => setReceipt(event.target.value)}
        />
      </label>
      {receiptError && <p className="premium-offer__error" role="alert">{receiptError}</p>}
      <p className="premium-offer__hint">ЮKassa отправит чек на эту почту.</p>
      {isWebShell() && receiptMatchesVerified ? (
        <p className="premium-offer__hint">
          Premium останется в вашем подтверждённом аккаунте. Повторно подтверждать почту не нужно.
        </p>
      ) : null}
      {isWebShell() && !accountVerified ? (
        <>
          <label className={`legal-choice__check${checkoutOnly ? ' legal-choice__check--gnh' : ''}`}>
            <input
              type="checkbox"
              checked={bindAccountEmail}
              onChange={(event) => setBindAccountEmail(event.target.checked)}
            />
            <span>Сохранить email для восстановления Premium</span>
          </label>
          <p className="premium-offer__hint">
            Если смените телефон или потеряете доступ к приложению, сможете восстановить покупки по
            этой почте. Ссылку для входа отправим только по вашему запросу.
          </p>
        </>
      ) : null}
      {isWebShell() && accountVerified && !receiptMatchesVerified ? (
        <p className="premium-offer__hint">
          Email для чека можно изменить. Подтверждённый email входа при этом не меняется.
        </p>
      ) : null}
      <p className="premium-overlay__legal">
        <button type="button" className="premium-overlay__legal-link" onClick={() => { haptic('light'); legal.openDocument('privacy') }}>
          Политика конфиденциальности
        </button>
        {' · '}
        <button type="button" className="premium-overlay__legal-link" onClick={() => { haptic('light'); legal.openDocument('agreement') }}>
          Пользовательское соглашение
        </button>
      </p>
    </div>
  )

  const payDock = (
    <div className={`premium-overlay__dock${checkoutOnly ? ' premium-overlay__dock--checkout' : ''}`}>
      <button
        type="button"
        className="premium-overlay__btn premium-overlay__btn--buy"
        onClick={handleBuyPremium}
        disabled={loading || !canStartPayment}
        aria-busy={loading}
        aria-disabled={loading || !canStartPayment}
      >
        {!checkoutOnly && (
          <img src={gem} alt="" className="premium-overlay__btn-icon premium-overlay__btn-icon--gem" decoding="async" aria-hidden />
        )}
        <span className="premium-overlay__btn-label">
          {loading ? 'Создаём оплату…' : buyLabel}
        </span>
      </button>
      <button
        type="button"
        className="premium-overlay__btn premium-overlay__btn--restore"
        onClick={handleRestorePurchase}
        disabled={restoreLoading}
        aria-busy={restoreLoading}
      >
        <img src={iconRestorePurchases} alt="" className="premium-overlay__btn-icon premium-overlay__btn-icon--restore" decoding="async" aria-hidden />
        <span className="premium-overlay__btn-label">
          {restoreLoading
            ? 'Проверяем покупки…'
            : isWebShell()
              ? 'Войти по email'
              : 'Восстановить покупки'}
        </span>
      </button>
    </div>
  )

  const goHome = () => {
    haptic('light')
    if (onGoHome) onGoHome()
    else {
      onClose()
      navigate('/')
    }
  }

  const cardContent = checkoutOnly ? (
    <div
      className="premium-overlay__card premium-overlay__card--checkout-only premium-checkout"
      onClick={asPage ? undefined : (e: React.MouseEvent) => e.stopPropagation()}
    >
      <div className="premium-checkout__top">
        <button type="button" className="premium-checkout__home" onClick={goHome}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m3 10 9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V10Z" />
          </svg>
          Домой
        </button>
        {!asPage && (
          <button
            type="button"
            className="premium-overlay__close premium-checkout__close"
            onClick={() => {
              haptic('light')
              onClose()
            }}
            aria-label="Закрыть"
          >
            <img src={iconCloseX} alt="" className="premium-overlay__close-icon" decoding="async" />
          </button>
        )}
      </div>
      <div className="premium-checkout__scroll">
        <header className="premium-checkout__head">
          <p className="premium-checkout__eyebrow">GAMENIGHT HOST</p>
          <h2 id="premium-overlay-title" className="premium-checkout__title">
            Оформление Premium
          </h2>
          <p className="premium-checkout__lead">Один Premium — играет вся компания</p>
        </header>
        {success && <p className="premium-overlay__success">Premium активирован</p>}
        {error && <p className="premium-overlay__error" role="alert">{error}</p>}
        {restoreToast && <p className="premium-overlay__toast" role="status">{restoreToast}</p>}
        {selectedPlan && checkoutCopy ? (
          <article className="premium-checkout__plan" aria-label="Выбранный тариф">
            <h3 className="premium-checkout__plan-title">{checkoutCopy.title}</h3>
            <p className="premium-checkout__plan-sub">{checkoutCopy.subtitle}</p>
            <p className="premium-checkout__plan-price">
              <span>{selectedPlan.priceRub}</span>
              <span className="premium-checkout__plan-currency">₽</span>
            </p>
            <p className="premium-checkout__plan-note">Без автопродления</p>
            {onChangePlan ? (
              <button
                type="button"
                className="premium-checkout__change"
                onClick={() => {
                  haptic('light')
                  onChangePlan()
                }}
              >
                Изменить тариф
              </button>
            ) : null}
          </article>
        ) : (
          <p className="premium-overlay__error">Тариф не выбран</p>
        )}
        {offerBlock}
        {payDock}
      </div>
    </div>
  ) : (
    <div
      className="premium-overlay__card"
      onClick={asPage ? undefined : (e: React.MouseEvent) => e.stopPropagation()}
    >
        {!asPage && (
          <button
            type="button"
            className="premium-overlay__close"
            onClick={() => {
              haptic('light')
              onClose()
            }}
            aria-label="Закрыть"
          >
            <img src={iconCloseX} alt="" className="premium-overlay__close-icon" decoding="async" />
          </button>
        )}
        <div className="premium-overlay__scroll">
        <div className="premium-overlay__hero">
          <span className="premium-overlay__gem-wrap" aria-hidden>
            <img src={gem} alt="" className="premium-overlay__diamond" decoding="async" />
          </span>
          <h2 id="premium-overlay-title" className="premium-overlay__heading">
            <span className="premium-overlay__heading-text">Premium-доступ</span>
          </h2>
        </div>
        {success && (
          <p className="premium-overlay__success">
            Premium активирован
          </p>
        )}
        {error && (
          <p className="premium-overlay__error">
            {error}
          </p>
        )}
        {restoreToast && (
          <p className="premium-overlay__toast">
            {restoreToast}
          </p>
        )}
        <div className="premium-overlay__description">
          <p className="premium-overlay__tagline">
            <span className="premium-overlay__tagline-text">
              Premium — это когда не надо думать, чем занять вечер
            </span>
          </p>
          <p className="premium-overlay__includes-title">
            <span className="premium-overlay__includes-title-line" aria-hidden />
            <img src={iconSparkle} alt="" className="premium-overlay__title-sparkle" decoding="async" aria-hidden />
            <span className="premium-overlay__includes-title-text">Что даёт подписка</span>
            <span className="premium-overlay__includes-title-line premium-overlay__includes-title-line--reverse" aria-hidden />
          </p>
          <ul className="premium-overlay__includes">
            {PREMIUM_INCLUDES.map((item) => (
              <li key={item.title}>
                <img src={iconCheckCircle} alt="" className="premium-overlay__check-icon" decoding="async" aria-hidden />
                <div className="premium-overlay__include-body">
                  <span className="premium-overlay__include-title">{item.title}</span>
                  <span className="premium-overlay__include-text">{item.text}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="premium-overlay__plans">
          <CatalogNotice plans={plansResource} offer={offerResource} />
          {plansResource.status === 'ready' && (
            <div className="premium-overlay__plans-list" role="radiogroup" aria-label="Тариф Premium">
              {plans.map((plan) => {
                const isSelected = plan.id === selectedPlanId
                const isLifetime = isLifetimePlan(plan.id, plan.durationDays)
                return (
                  <button
                    key={plan.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    className={`premium-overlay__plan${isSelected ? ' premium-overlay__plan--selected' : ''}${isLifetime ? ' premium-overlay__plan--lifetime' : ''}`}
                    onClick={() => {
                      haptic('light')
                      setSelectedPlanId(plan.id)
                    }}
                  >
                    <span className="premium-overlay__plan-radio" aria-hidden />
                    <div className="premium-overlay__plan-main">
                      {isLifetime && (
                        <span className="premium-overlay__plan-badge">
                          <img src={iconSparkle} alt="" className="premium-overlay__plan-badge-icon" decoding="async" aria-hidden />
                          Лучший выбор
                        </span>
                      )}
                      <span className="premium-overlay__plan-period">{formatPlanPeriod(plan.durationDays)}</span>
                      {isLifetime && (
                        <span className="premium-overlay__plan-tagline">Один раз — доступ навсегда</span>
                      )}
                    </div>
                    <div className="premium-overlay__plan-price-wrap">
                      <span className="premium-overlay__plan-price">{plan.priceRub}</span>
                      <span className="premium-overlay__plan-currency">₽</span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {offerBlock}

        <div className="premium-overlay__bottom">
          <p className="premium-overlay__footer">
            <img src={iconLockSecure} alt="" className="premium-overlay__footer-lock" decoding="async" aria-hidden />
            <span>Вы можете продолжить играть бесплатно или оформить Premium-подписку</span>
          </p>
        </div>
        </div>

        {payDock}

        {asPage && (
          <button
            type="button"
            className="premium-overlay__btn premium-overlay__btn--dismiss"
            onClick={() => {
              haptic('light')
              onClose()
            }}
          >
            Назад
          </button>
        )}
      </div>
  )

  if (asPage) {
    return (
      <>
        {cardContent}
      </>
    )
  }

  return createPortal(
    <div
      className={`premium-overlay${insideWeb ? ' gnh-inside-portal' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="premium-overlay-title"
      onClick={handleBackdropClick}
    >
      {cardContent}
    </div>,
    document.body
  )
}
