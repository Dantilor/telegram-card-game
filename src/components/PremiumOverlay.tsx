import { useEffect, useState, useRef } from 'react'
import { haptic } from '../utils/telegram'
import type { DocumentType } from '../data/documents'
import DocumentModal from './DocumentModal'
import { getTelegramWebApp, getInitData } from '../lib/telegram'
import { trackEvent } from '../lib/analytics'
import { apiPost, apiGet } from '../lib/api'
import { usePremium } from '../contexts/PremiumContext'
import {
  DEFAULT_PLAN_ID,
  formatPlanPeriod,
  formatPlanPriceLabel,
  isLifetimePlan,
  type PlanOption,
} from '../utils/planLabel'
import './PremiumOverlay.css'

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
  const [documentModalType, setDocumentModalType] = useState<DocumentType | null>(null)
  const [plans, setPlans] = useState<PlanOption[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState<string>(DEFAULT_PLAN_ID)
  const [plansLoading, setPlansLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [restoreLoading, setRestoreLoading] = useState(false)
  const [restoreToast, setRestoreToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const pollAbortRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (isOpen) {
      setPlansLoading(true)
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
        .catch(() => setPlans([]))
        .finally(() => setPlansLoading(false))
    }
  }, [isOpen])

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

    const pid = selectedPlan?.id
    if (!pid) {
      setError('Нет доступных тарифов')
      return
    }

    setError(null)
    setLoading(true)
    try {
      const res = await apiPost<{ ok?: boolean; confirmationUrl?: string }>(
        '/api/payments/yookassa/create',
        { planId: pid }
      )
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
      const err = e as Error & { status?: number }
      if (import.meta.env.DEV) console.warn('[PremiumOverlay] YooKassa error:', err.message)
      if (err.status === 401) {
        setError('Откройте приложение внутри Telegram для оплаты')
      } else if (err.status === 502) {
        setError('Платёжный сервис сейчас недоступен. Попробуйте ещё раз чуть позже.')
      } else if (err.status === 503) {
        setError('Оплата временно недоступна. Попробуйте позже.')
      } else {
        setError('Не удалось создать платёж. Попробуйте ещё раз.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen && !asPage) return null

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
            ✕
          </button>
        )}
        <h2 id="premium-overlay-title" className="premium-overlay__heading">
          <span className="premium-overlay__icon" aria-hidden>💎</span>
          <span className="premium-overlay__heading-text">Premium-доступ</span>
        </h2>
        <p className="premium-overlay__subtitle">Этот контент доступен по подписке</p>
        {success && (
          <p className="premium-overlay__success" style={{ color: 'var(--success, #22c55e)', marginBottom: '0.5rem' }}>
            Premium активирован
          </p>
        )}
        {error && (
          <p className="premium-overlay__error" style={{ color: 'var(--accent)', marginBottom: '0.5rem' }}>
            {error}
          </p>
        )}
        {restoreToast && (
          <p className="premium-overlay__toast" style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>
            {restoreToast}
          </p>
        )}
        <div className="premium-overlay__description">
          <p>
            Откройте полный доступ ко всем играм, колодам и избранному контенту. Premium расширяет возможности приложения и делает игру ещё интереснее.
          </p>
          <p>Что даёт подписка:</p>
          <ul className="premium-overlay__includes">
            <li>Все колоды в карточной игре (вопросы для пар, компании, свиданий)</li>
            <li>Все игры: Ассоциации, Мафия, Активитус, Саботаж, Битва умов</li>
            <li>Правда или действие (расширенные наборы)</li>
            <li>Избранное — сохраняй вопросы и возвращайся к ним</li>
            <li>Темы оформления (Neon, Portal, Sunset и др.)</li>
            <li>Новые игры и колоды, которые будут появляться со временем</li>
          </ul>
        </div>

        <div className="premium-overlay__plans">
          <p className="premium-overlay__plans-title">Выберите тариф</p>
          {plansLoading ? (
            <p className="premium-overlay__plans-loading">Загрузка тарифов…</p>
          ) : plans.length === 0 ? (
            <p className="premium-overlay__plans-loading">Тарифы временно недоступны</p>
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
                        <span className="premium-overlay__plan-badge">Спецпредложение</span>
                      )}
                      <span className="premium-overlay__plan-period">{formatPlanPeriod(plan.durationDays)}</span>
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

        <p className="premium-overlay__footer">
          Вы можете продолжить играть бесплатно или оформить Premium-подписку
        </p>
        <p className="premium-overlay__legal">
          Оплачивая Premium, вы соглашаетесь с{' '}
          <button type="button" className="premium-overlay__legal-link" onClick={() => { haptic('light'); setDocumentModalType('terms') }}>
            Условиями использования
          </button>
          ,{' '}
          <button type="button" className="premium-overlay__legal-link" onClick={() => { haptic('light'); setDocumentModalType('privacy') }}>
            Политикой конфиденциальности
          </button>
          ,{' '}
          <button type="button" className="premium-overlay__legal-link" onClick={() => { haptic('light'); setDocumentModalType('premium') }}>
            Условиями Premium
          </button>
          {' '}и{' '}
          <button type="button" className="premium-overlay__legal-link" onClick={() => { haptic('light'); setDocumentModalType('adultPolicy') }}>
            Политикой доступа к категориям 18+
          </button>
          .
        </p>
        <button
          type="button"
          className="btn btn--primary premium-overlay__btn premium-overlay__btn--buy"
          onClick={handleBuyPremium}
          disabled={loading || plansLoading || !selectedPlan}
        >
          {loading ? 'Загрузка…' : plansLoading ? 'Загрузка…' : buyLabel}
        </button>
        <button
          type="button"
          className="btn btn--ghost premium-overlay__btn"
          onClick={handleRestorePurchase}
          disabled={restoreLoading}
        >
          {restoreLoading ? 'Загрузка…' : 'Восстановить покупки'}
        </button>
        <button
          type="button"
          className="btn btn--ghost premium-overlay__btn premium-overlay__btn--dismiss"
          onClick={() => {
            haptic('light')
            onClose()
          }}
        >
          {asPage ? 'Назад' : 'Понятно'}
        </button>
      </div>
  )

  if (asPage) {
    return (
      <>
        {cardContent}
        <DocumentModal
          isOpen={documentModalType !== null}
          onClose={() => setDocumentModalType(null)}
          documentType={documentModalType ?? 'privacy'}
        />
      </>
    )
  }

  return (
    <div
      className="premium-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="premium-overlay-title"
      onClick={handleBackdropClick}
    >
      {cardContent}
      <DocumentModal
        isOpen={documentModalType !== null}
        onClose={() => setDocumentModalType(null)}
        documentType={documentModalType ?? 'privacy'}
      />
    </div>
  )
}
