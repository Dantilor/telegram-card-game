import { useCallback, useState } from 'react'
import { usePremium } from '../contexts/PremiumContext'
import { isGameLocked } from '../utils/access'
import { hapticSelection } from '../utils/haptics'

/** Gate the main start CTA: setup screens stay open, play requires Premium when game is locked. */
export function useGameStartGate(gameId: string, ctaBaseClass = 'game-page__cta') {
  const { isPremium } = usePremium()
  const [premiumOverlayOpen, setPremiumOverlayOpen] = useState(false)
  const startLocked = isGameLocked(gameId, isPremium)

  const gatedStart = useCallback(
    (onStart: () => void) => {
      hapticSelection()
      if (startLocked) {
        setPremiumOverlayOpen(true)
        return
      }
      onStart()
    },
    [startLocked],
  )

  const startCtaClassName = startLocked
    ? `${ctaBaseClass} ${ctaBaseClass}--premium-locked`
    : ctaBaseClass

  return {
    startLocked,
    premiumOverlayOpen,
    closePremiumOverlay: () => setPremiumOverlayOpen(false),
    gatedStart,
    startCtaClassName,
  }
}
