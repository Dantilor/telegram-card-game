import { useEffect, useState, useRef } from 'react'
import { haptic } from '../utils/telegram'
import type { DocumentType } from '../data/documents'
import DocumentModal from './DocumentModal'
import { getTelegramWebApp, getInitData } from '../lib/telegram'
import { trackEvent } from '../lib/analytics'
import { apiPost, apiGet } from '../lib/api'
import { usePremium } from '../contexts/PremiumContext'
import './PremiumOverlay.css'

const POLL_INTERVAL_MS = 3000
const POLL_ATTEMPTS = 5

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

type Plan = { id: string; title: string; priceRub: number; durationDays: number }

type Props = {
  isOpen: boolean
  onClose: () => void
  onBuyPremium?: () => void
}

export default function PremiumOverlay({ isOpen, onClose, onBuyPremium }: Props) {
  const { refresh } = usePremium()
  const [documentModalType, setDocumentModalType] = useState<DocumentType | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
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
      apiGet<{ ok?: boolean; plans?: Plan[] }>('/api/plans')
        .then((res) => {
          if (res.ok && Array.isArray(res.plans)) {
            setPlans(res.plans)
          } else {
            setPlans([])
          }
        })
        .catch(() => setPlans([]))
        .finally(() => setPlansLoading(false))
    }
  }, [isOpen])

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
    if (isOpen) {
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
  }, [isOpen, onClose])

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

  const handleBuyPremium = async (planId?: string) => {
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

    const pid = planId ?? plans[0]?.id ?? 'premium_3m'
    if (!pid) {
      setError('Нет доступных тарифов')
      return
    }

    setError(null)
    setLoading(true)
    try {
      const res = await apiPost<{ ok?: boolean; confirmationUrl?: string }>('/api/payments/yookassa/create', { planId: pid })
      const url = res.confirmationUrl
      if (!url) {
        setError('Не удалось создать платёж')
        return
      }
      trackEvent('yookassa_redirect')

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
      console.error('[PremiumOverlay] YooKassa error:', err.message)
      if (err.status === 401) {
        setError('Откройте приложение внутри Telegram для оплаты')
      } else {
        setError(err.message || 'Не удалось создать платёж')
      }
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const plan = plans[0]
  const priceText = plan
    ? `${plan.priceRub} ₽ / ${Math.round(plan.durationDays / 30)} мес.`
    : '259 ₽ / 3 мес.'

  return (
    <div
      className="premium-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="premium-overlay-title"
      onClick={handleBackdropClick}
    >
      <div className="premium-overlay__card" onClick={(e) => e.stopPropagation()}>
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
        <h2 id="premium-overlay-title" className="premium-overlay__heading">
          <span className="premium-overlay__icon" aria-hidden>💎</span>
          Premium-доступ
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
          {!plansLoading && (
            <p className="premium-overlay__price">
              Стоимость подписки:<br />
              {priceText}
            </p>
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
          {' '}и{' '}
          <button type="button" className="premium-overlay__legal-link" onClick={() => { haptic('light'); setDocumentModalType('premium') }}>
            Условиями Premium
          </button>
          .
        </p>
        <button
          type="button"
          className="btn btn--primary premium-overlay__btn premium-overlay__btn--buy"
          onClick={() => handleBuyPremium()}
          disabled={loading || plansLoading}
        >
          {loading ? 'Загрузка…' : plansLoading ? 'Загрузка…' : `Открыть Premium · ${priceText}`}
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
          className="btn btn--ghost premium-overlay__btn"
          onClick={() => {
            haptic('light')
            onClose()
          }}
        >
          Понятно
        </button>
      </div>
      <DocumentModal
        isOpen={documentModalType !== null}
        onClose={() => setDocumentModalType(null)}
        documentType={documentModalType ?? 'privacy'}
      />
    </div>
  )
}
