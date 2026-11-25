import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useBack } from '../hooks/useBack'
import { usePremium } from '../contexts/PremiumContext'
import { haptic } from '../utils/telegram'
import { isWebShell } from '../config/shell'
import { formatPremiumUntilLabel } from '../utils/planLabel'
import crystalUrl from './gnh-inside/assets/reference-crystal.webp'
import HomeButton from '../components/HomeButton'
import BackButton from '../components/BackButton'
import PremiumOverlay from '../components/PremiumOverlay'
import WebPremiumExperience from './WebPremiumExperience'
import '../styles/GamePageShell.css'
import './PremiumPage.css'

const EXPECTING_PAYMENT_FLAG = 'tcg_expecting_payment'
const PAYMENT_RETURN_POLL_ATTEMPTS = 30
const PAYMENT_RETURN_POLL_INTERVAL_MS = 2000

function PremiumPage() {
  const handleBack = useBack('/')
  const navigate = useNavigate()
  const { isPremium, activeUntil, refreshPremium } = usePremium()
  const [searchParams, setSearchParams] = useSearchParams()
  const [restoreStatus, setRestoreStatus] = useState<string | null>(null)
  const [restoreLoading, setRestoreLoading] = useState(false)
  const [paymentReturnStatus, setPaymentReturnStatus] = useState<string | null>(null)
  const restoreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const paymentPollRef = useRef(false)
  const mountedRef = useRef(true)
  const isPaymentReturn = searchParams.get('payment') === 'return'

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // WEB return_url from YooKassa — refresh status; never treat return alone as paid.
  // Removing ?payment=return re-renders this page; the poll must survive that and stop only on unmount.
  useEffect(() => {
    if (!isPaymentReturn) return
    try {
      sessionStorage.setItem(EXPECTING_PAYMENT_FLAG, String(Date.now()))
    } catch {
      /* ignore */
    }
    setSearchParams({}, { replace: true })
    if (paymentPollRef.current) return
    paymentPollRef.current = true
    setPaymentReturnStatus('Проверяем оплату…')
    ;(async () => {
      for (let i = 0; i < PAYMENT_RETURN_POLL_ATTEMPTS; i += 1) {
        if (!mountedRef.current) break
        const result = await refreshPremium()
        if (!mountedRef.current) break
        if (result?.isPremium) {
          try {
            sessionStorage.removeItem(EXPECTING_PAYMENT_FLAG)
          } catch {
            /* ignore */
          }
          setPaymentReturnStatus('Premium активирован')
          paymentPollRef.current = false
          return
        }
        if (i < PAYMENT_RETURN_POLL_ATTEMPTS - 1) {
          await new Promise((r) => setTimeout(r, PAYMENT_RETURN_POLL_INTERVAL_MS))
        }
      }
      if (mountedRef.current) {
        setPaymentReturnStatus(
          'Оплата ещё не подтверждена. Если вы оплатили — подождите или нажмите «Восстановить покупки».'
        )
      }
      paymentPollRef.current = false
    })()
  }, [isPaymentReturn, setSearchParams, refreshPremium])

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
      if (isWebShell()) {
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
  }, [navigate, refreshPremium])

  if (isWebShell() && isPremium) {
    return (
      <div className="premium-page">
        <div className="page-top">
          <div className="breadcrumb">
            <button type="button" className="ghost-link" onClick={handleBack}>
              Назад
            </button>
          </div>
        </div>
        <div className="premium-heading">
          <img className="crystal" src={crystalUrl} alt="" width={120} height={120} />
          <div>
            <h1 className="page-title">Premium-доступ</h1>
            <p className="lead">{formatPremiumUntilLabel(activeUntil)}</p>
          </div>
        </div>
        {paymentReturnStatus && <p className="premium-page__status">{paymentReturnStatus}</p>}
        <section className="glass benefit-card">
          <div className="premium-page__actions">
            <button
              type="button"
              className="button button-primary"
              onClick={handleRestorePurchase}
              disabled={restoreLoading}
            >
              {restoreLoading ? 'Загрузка…' : isWebShell() ? 'Войти по email' : 'Восстановить покупки'}
            </button>
            {restoreStatus && <span className="premium-page__toast">{restoreStatus}</span>}
          </div>
        </section>
      </div>
    )
  }

  if (isWebShell()) {
    return (
      <div className="premium-page premium-page--web-experience">
        {paymentReturnStatus && <p className="premium-page__status">{paymentReturnStatus}</p>}
        <WebPremiumExperience initialView="premium" />
      </div>
    )
  }

  if (isPremium) {
    return (
      <div className="game-page premium-page game-page--enter">
        <div className="game-page__top">
          <HomeButton className="game-page__nav-btn" />
          <BackButton onClick={handleBack} className="game-page__nav-btn game-page__back" />
        </div>
        <header className="premium-page__header">
          <h1 className="premium-page__title">Premium-доступ</h1>
        </header>
        <section className="premium-page__card premium-page__card--active game-page__panel game-page__panel--glow-b">
          {paymentReturnStatus && <p className="premium-page__status">{paymentReturnStatus}</p>}
          <p className="premium-page__status">
            Premium активен до {activeUntil ? new Date(activeUntil).toLocaleDateString('ru-RU') : '—'}
          </p>
          <div className="premium-page__actions">
            <button
              type="button"
              className="game-page__btn game-page__btn--secondary"
              onClick={handleRestorePurchase}
              disabled={restoreLoading}
            >
              {restoreLoading ? 'Загрузка…' : 'Восстановить покупки'}
            </button>
            {restoreStatus && (
              <span className="premium-page__toast">{restoreStatus}</span>
            )}
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="game-page premium-page game-page--enter">
      <div className="game-page__top">
        <HomeButton className="game-page__nav-btn" />
        <BackButton onClick={handleBack} className="game-page__nav-btn game-page__back" />
      </div>
      <div className="premium-page__content">
        {paymentReturnStatus && (
          <p className="premium-page__status" style={{ marginBottom: 12 }}>{paymentReturnStatus}</p>
        )}
        <PremiumOverlay
          isOpen={true}
          onClose={handleBack}
          asPage
        />
      </div>
    </div>
  )
}

export default PremiumPage
