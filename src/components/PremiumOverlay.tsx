import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { haptic } from '../utils/telegram'
import { getTelegramWebApp, getInitData } from '../lib/telegram'
import { useLegal } from '../legal/LegalProvider'
import { classifyReceipt, fetchPublicDocument, LegalClientError, submitNewPremiumOrder, userFacingLoadError } from '../legal/client'
import type { PublicDocument } from '../legal/types'
import { trackEvent } from '../lib/analytics'
import { apiGet } from '../lib/api'
import { usePremium } from '../contexts/PremiumContext'
import { useTheme } from '../hooks/useTheme'
import {
  DEFAULT_PLAN_ID,
  formatPlanPeriod,
  formatPlanPriceLabel,
  isLifetimePlan,
  type PlanOption,
} from '../utils/planLabel'
import gemNeon from '../assets/icons/gnh-light-pro/premium-diamond-pro.png'
import gemLight from '../assets/icons/gnh-calm-pro/premium-diamond-pro.png'
import gemSunset from '../assets/icons/gnh-sunset-pro/premium-diamond-pro.png'
import gemCalm from '../assets/icons/gnh/premium-diamond.png'
import iconCheckCircle from '../assets/icons/premium-modal/check-circle.svg'
import iconCloseX from '../assets/icons/premium-modal/close-x.svg'
import iconClock from '../assets/icons/premium-modal/clock.svg'
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

type Props = {
  isOpen: boolean
  onClose: () => void
  onBuyPremium?: () => void
  /** Режим страницы: без оверлея, с кнопкой «Назад» */
  asPage?: boolean
}

export default function PremiumOverlay({ isOpen, onClose, onBuyPremium, asPage }: Props) {
  const { refresh } = usePremium()
  const legal = useLegal()
  const [theme] = useTheme()
  const gem = GEMS_BY_THEME[theme]
  const [offerDocument, setOfferDocument] = useState<PublicDocument | null>(null)
  const [offerError, setOfferError] = useState<string | null>(null)
  const [offerChecked, setOfferChecked] = useState(false)
  const [receipt, setReceipt] = useState('')
  const [plans, setPlans] = useState<PlanOption[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState<string>(DEFAULT_PLAN_ID)
  const [plansLoading, setPlansLoading] = useState(true)
  const [plansError, setPlansError] = useState<string | null>(null)
  const [plansAttempt, setPlansAttempt] = useState(0)
  const [loading, setLoading] = useState(false)
  const [restoreLoading, setRestoreLoading] = useState(false)
  const [restoreToast, setRestoreToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [offerAttempt, setOfferAttempt] = useState(0)
  const pollAbortRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setOfferChecked(false)
    setReceipt('')
    let cancelled = false
    fetchPublicDocument('offer', undefined, import.meta.env)
      .then((document) => {
        if (!cancelled) {
          setOfferDocument(document)
          setOfferError(null)
        }
      })
      .catch((reason: unknown) => {
        if (cancelled) return
        setOfferDocument(null)
        setOfferError(userFacingLoadError(reason))
      })
    return () => {
      cancelled = true
    }
  }, [isOpen, offerAttempt])

  useEffect(() => {
    if (isOpen) {
      setPlansLoading(true)
      setPlansError(null)
      apiGet<{ ok?: boolean; plans?: PlanOption[] }>('/api/plans')
        .then((res) => {
          if (res.ok && Array.isArray(res.plans) && res.plans.length > 0) {
            setPlans(res.plans)
            const hasDefault = res.plans.some((p) => p.id === DEFAULT_PLAN_ID)
            setSelectedPlanId(hasDefault ? DEFAULT_PLAN_ID : res.plans[0].id)
          } else {
            setPlans([])
          }
        })
        .catch((reason: unknown) => {
          setPlans([])
          setPlansError(userFacingLoadError(reason))
        })
        .finally(() => setPlansLoading(false))
    }
  }, [isOpen, plansAttempt])

  const selectedPlan = plans.find((p) => p.id === selectedPlanId) ?? plans[0] ?? null

  const handleRestorePurchase = async () => {
    haptic('medium')
    setRestoreToast(null)
    setRestoreLoading(true)
    try {
      const result = await refresh()
      setRestoreToast(result?.isPremium ? '✅ Покупки восстановлены' : 'Покупок не найдено')
      if (result?.isPremium) {
        setSuccess(true)
        setError(null)
        setTimeout(() => {
          onClose()
          setSuccess(false)
        }, 1500)
      }
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

    const initData = getInitData()
    if (!initData) {
      setError('Откройте приложение внутри Telegram для оплаты')
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
    if (!receipt.trim()) {
      setError('Для электронного чека укажите email или телефон.')
      return
    }

    setError(null)
    setLoading(true)
    try {
      const res = await submitNewPremiumOrder({
        document: offerDocument,
        plan: {
          id: plan.id,
          title: plan.title,
          priceRub: plan.priceRub,
          durationDays: plan.durationDays,
        },
        receiptRaw: receipt,
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
      if (tg?.openLink) {
        tg.openLink(url)
      } else {
        window.open(url, '_blank', 'noopener,noreferrer')
      }
      pollAbortRef.current?.()
      pollAbortRef.current = pollPremiumStatus(refresh, () => {
        setSuccess(true)
        setError(null)
        setTimeout(() => {
          onClose()
          setSuccess(false)
        }, 1500)
      })
    } catch (e) {
      if (e instanceof LegalClientError && e.code === 'version_mismatch') {
        setOfferChecked(false)
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

  const receiptCheck = receipt.trim() ? classifyReceipt(receipt) : null
  const receiptError = receiptCheck && 'error' in receiptCheck ? receiptCheck.error : null
  const canStartPayment = Boolean(selectedPlan && offerDocument && offerChecked && receiptCheck && !receiptError && !offerError)
  const buyLabel = selectedPlan
    ? `Открыть Premium · ${formatPlanPriceLabel(selectedPlan)}`
    : 'Открыть Premium'

  const cardContent = (
    <div className="premium-overlay__card" onClick={asPage ? undefined : (e: React.MouseEvent) => e.stopPropagation()}>
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
          {plansLoading ? (
            <p className="premium-overlay__plans-loading">Загрузка тарифов…</p>
          ) : plans.length === 0 ? (
            <div className="premium-overlay__plans-empty">
              <img src={iconClock} alt="" className="premium-overlay__plans-empty-icon" decoding="async" aria-hidden />
              <p className="premium-overlay__plans-loading">{plansError ?? 'Тарифы временно недоступны'}</p>
              <button type="button" className="premium-overlay__legal-link" onClick={() => setPlansAttempt((value) => value + 1)}>
                Повторить загрузку
              </button>
            </div>
          ) : (
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

        <div className="premium-offer">
          {selectedPlan && (
            <p className="premium-offer__summary">
              {selectedPlan.title}: {selectedPlan.priceRub} ₽, {formatPlanPeriod(selectedPlan.durationDays)}. Автопродления нет.
            </p>
          )}
          <button type="button" className="premium-overlay__legal-link" onClick={() => { haptic('light'); legal.openDocument('offer') }}>
            Открыть публичную оферту
          </button>
          {offerError && (
            <p className="premium-offer__error">
              {offerError}{' '}
              <button type="button" className="premium-overlay__legal-link" onClick={() => setOfferAttempt((value) => value + 1)}>
                Повторить загрузку
              </button>
            </p>
          )}
          <label className="legal-choice__check">
            <input
              type="checkbox"
              checked={offerChecked}
              disabled={!offerDocument || offerDocument.confirmation.available !== true || offerDocument.confirmation.mode !== 'statement'}
              onChange={(event) => setOfferChecked(event.target.checked)}
            />
            <span>
              {offerDocument?.confirmation.available === true && offerDocument.confirmation.mode === 'statement'
                ? offerDocument.confirmation.statement
                : 'Текст оферты ещё не загружен'}
            </span>
          </label>
          <label className="premium-offer__field">
            <span>Email или телефон для чека</span>
            <input
              value={receipt}
              placeholder="name@example.com или +79990000000"
              autoComplete="email"
              inputMode="text"
              aria-invalid={receiptError ? true : undefined}
              onChange={(event) => setReceipt(event.target.value)}
            />
          </label>
          {receiptError && <p className="premium-offer__error" role="alert">{receiptError}</p>}
          <p className="premium-offer__hint">Контакт нужен только для чека и не включает рекламу или аналитику.</p>
        </div>

        <button
          type="button"
          className="premium-overlay__btn premium-overlay__btn--buy"
          onClick={handleBuyPremium}
          disabled={loading || plansLoading || !canStartPayment}
          aria-disabled={loading || plansLoading || !canStartPayment}
        >
          <img src={gem} alt="" className="premium-overlay__btn-icon premium-overlay__btn-icon--gem" decoding="async" aria-hidden />
          <span className="premium-overlay__btn-label">
            {loading ? 'Загрузка…' : plansLoading ? 'Загрузка…' : buyLabel}
          </span>
        </button>
        <button
          type="button"
          className="premium-overlay__btn premium-overlay__btn--restore"
          onClick={handleRestorePurchase}
          disabled={restoreLoading}
        >
          <img src={iconRestorePurchases} alt="" className="premium-overlay__btn-icon premium-overlay__btn-icon--restore" decoding="async" aria-hidden />
          <span className="premium-overlay__btn-label">
            {restoreLoading ? 'Загрузка…' : 'Восстановить покупки'}
          </span>
        </button>

        <div className="premium-overlay__bottom">
          <p className="premium-overlay__footer">
            <img src={iconLockSecure} alt="" className="premium-overlay__footer-lock" decoding="async" aria-hidden />
            <span>Вы можете продолжить играть бесплатно или оформить Premium-подписку</span>
          </p>
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
      className="premium-overlay"
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
