import { useState, useCallback, useRef } from 'react'
import { useBack } from '../hooks/useBack'
import { usePremium } from '../contexts/PremiumContext'
import { haptic } from '../utils/telegram'
import HomeButton from '../components/HomeButton'
import BackButton from '../components/BackButton'
import PremiumOverlay from '../components/PremiumOverlay'
import '../styles/GamePageShell.css'
import './PremiumPage.css'

function PremiumPage() {
  const handleBack = useBack('/')
  const { isPremium, activeUntil, refreshPremium } = usePremium()
  const [restoreStatus, setRestoreStatus] = useState<string | null>(null)
  const [restoreLoading, setRestoreLoading] = useState(false)
  const restoreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
