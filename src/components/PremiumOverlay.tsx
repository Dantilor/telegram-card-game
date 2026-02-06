import { useEffect, useState, useRef } from 'react'
import { PREMIUM_PLAN } from '../config/premium'
import { haptic } from '../utils/telegram'
import { openLegalLink } from '../lib/legal'
import { getTelegramWebApp, getInitData } from '../lib/telegram'
import { trackEvent } from '../lib/analytics'
import { apiPost, apiGet } from '../lib/api'
import { usePremium } from '../contexts/PremiumContext'
import './PremiumOverlay.css'

const isDev = import.meta.env.DEV
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

type Props = {
  isOpen: boolean
  onClose: () => void
  onBuyPremium?: () => void
}

export default function PremiumOverlay({ isOpen, onClose, onBuyPremium }: Props) {
  const { refresh } = usePremium()
  const [loading, setLoading] = useState(false)
  const [restoreLoading, setRestoreLoading] = useState(false)
  const [restoreToast, setRestoreToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const pollAbortRef = useRef<(() => void) | null>(null)

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

    setError(null)
    setLoading(true)
    try {
      const res = await apiPost<{ invoiceLink: string }>('/api/invoice', { plan: 'month' })
      const invoiceLink = res.invoiceLink
      trackEvent('invoice_opened')

      const tg = getTelegramWebApp()
      if (tg?.openInvoice) {
        tg.openInvoice(invoiceLink, (status: string) => {
          if (isDev) console.log('[PremiumOverlay] invoice status:', status)
          const paid = status === 'paid' || status === 'successful'
          const failed = status === 'cancelled' || status === 'failed'
          if (paid) {
            trackEvent('invoice_paid')
            trackEvent('premium_active')
            refresh()
            setSuccess(true)
            setError(null)
            setTimeout(() => {
              onClose()
              setSuccess(false)
            }, 1500)
          } else if (failed) {
            setError('Оплата отменена или не прошла')
            setLoading(false)
          }
          if (!failed) {
            pollAbortRef.current?.()
            pollAbortRef.current = pollPremiumStatus(refresh)
          }
        })
      } else {
        window.location.href = invoiceLink
        onClose()
      }
    } catch (e) {
      const err = e as Error & { status?: number }
      console.error('[PremiumOverlay] invoice error:', err.message)
      if (err.status === 401) {
        setError('Откройте приложение внутри Telegram для оплаты')
      } else {
        setError(err.message || 'Не удалось создать счёт')
      }
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

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
            С подпиской открывается полный доступ ко всем играм и режимам.
          </p>
          <p>Что даёт подписка:</p>
          <ul className="premium-overlay__includes">
            <li>Все колоды в карточной игре (вопросы для пар, компании, свиданий)</li>
            <li>Все игры: Alias, Мафия, Activity, Саботаж, Викторина</li>
            <li>Правда или действие (расширенные наборы)</li>
            <li>Избранное — сохраняй вопросы и возвращайся к ним</li>
            <li>Темы оформления (Neon, Portal, Sunset и др.)</li>
            <li>Новые игры и колоды, которые будут появляться со временем</li>
          </ul>
          <p className="premium-overlay__price">
            Стоимость подписки:<br />
            {PREMIUM_PLAN.priceRub} ₽ на {PREMIUM_PLAN.durationMonths} месяцев
          </p>
        </div>
        <p className="premium-overlay__footer">
          Вы можете продолжить играть бесплатно или открыть полный доступ
        </p>
        <p className="premium-overlay__legal">
          Оплачивая Premium, вы соглашаетесь с{' '}
          <button type="button" className="premium-overlay__legal-link" onClick={() => openLegalLink('terms')}>
            Условиями
          </button>{' '}
          и{' '}
          <button type="button" className="premium-overlay__legal-link" onClick={() => openLegalLink('privacy')}>
            Политикой конфиденциальности
          </button>
        </p>
        <button
          type="button"
          className="btn btn--primary premium-overlay__btn premium-overlay__btn--buy"
          onClick={handleBuyPremium}
          disabled={loading}
        >
          {loading ? 'Загрузка…' : `Открыть Premium · ${PREMIUM_PLAN.priceRub} ₽ / ${PREMIUM_PLAN.durationMonths} месяцев`}
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
    </div>
  )
}
