import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePremium } from '../contexts/PremiumContext'
import { isWebShell } from '../config/shell'
import { isGameLocked } from '../utils/access'
import { hapticSelection } from '../utils/haptics'
import { acquireGameSessionLease, notifyGameSessionLimitReached } from '../lib/gameSessionLease'

/** Gate the main start CTA: Premium paywall first, then optional concurrent game-session lease. */
export function useGameStartGate(gameId: string, ctaBaseClass = 'game-page__cta') {
  const { isPremium } = usePremium()
  const navigate = useNavigate()
  const [premiumOverlayOpen, setPremiumOverlayOpen] = useState(false)
  const [sessionBusy, setSessionBusy] = useState(false)
  const startLocked = isGameLocked(gameId, isPremium)

  const gatedStart = useCallback(
    (onStart: () => void) => {
      hapticSelection()
      if (startLocked) {
        // WEB: go straight to the kit Premium page — never flash the legacy overlay.
        if (isWebShell()) {
          navigate('/premium?focus=plans')
          return
        }
        setPremiumOverlayOpen(true)
        return
      }
      if (sessionBusy) return
      setSessionBusy(true)
      void (async () => {
        try {
          const lease = await acquireGameSessionLease(gameId)
          if (!lease.ok && lease.limitReached) {
            notifyGameSessionLimitReached()
            return
          }
          onStart()
        } finally {
          setSessionBusy(false)
        }
      })()
    },
    [startLocked, sessionBusy, gameId, navigate],
  )

  const startCtaClassName = startLocked
    ? `${ctaBaseClass} ${ctaBaseClass}--premium-locked`
    : ctaBaseClass

  return {
    startLocked,
    premiumOverlayOpen,
    closePremiumOverlay: () => setPremiumOverlayOpen(false),
    sessionBusy,
    gatedStart,
    startCtaClassName,
  }
}
