import { useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBack } from '../hooks/useBack'
import { usePremium } from '../contexts/PremiumContext'
import { haptic } from '../utils/telegram'
import { isWebShell } from '../config/shell'
import { formatPremiumUntilLabel } from '../utils/planLabel'
import crystalUrl from './gnh-inside/assets/reference-crystal.webp'
import HomeButton from '../components/HomeButton'
import BackButton from '../components/BackButton'
import PremiumOverlay from '../components/PremiumOverlay'
import PaymentReturnBanner from '../components/PaymentReturnBanner'
import { usePaymentReturn } from '../hooks/usePaymentReturn'
import { useWebSession } from '../shell/WebSessionContext'
import WebPremiumExperience from './WebPremiumExperience'
import '../styles/GamePageShell.css'
import './PremiumPage.css'

function PremiumPage() {
  const handleBack = useBack('/')
  const navigate = useNavigate()
  const { isPremium, activeUntil, refreshPremium } = usePremium()
  const webSession = useWebSession()
  const [restoreStatus, setRestoreStatus] = useState<string | null>(null)
  const [restoreLoading, setRestoreLoading] = useState(false)
  const restoreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // WEB return_url from YooKassa: confirm the stored order on the server, then force /api/me.
  // Never treats the return alone as paid; see usePaymentReturn / paymentReturnFlow.
  const { phase: paymentPhase, retry: retryPaymentCheck } = usePaymentReturn(refreshPremium)
  const paymentBanner = (
    <PaymentReturnBanner
      phase={paymentPhase}
      onRetry={retryPaymentCheck}
      onLogin={() => navigate('/login')}
      onGames={() => navigate('/games')}
      onBindEmail={isWebShell() && !webSession.session?.emailVerified ? () => navigate('/profile') : undefined}
    />
  )
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
        {paymentBanner}
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
        {paymentBanner}
        {paymentPhase === 'checking' ? null : <WebPremiumExperience initialView="premium" />}
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
          {paymentBanner}
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
        {paymentBanner}
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
