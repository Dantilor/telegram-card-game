import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { confirmWebPayment } from '../lib/confirmWebPayment'
import {
  clearPendingWebPayment,
  markPendingWebPaymentReturned,
  readPendingWebPayment,
} from '../lib/pendingWebPayment'
import { runPaymentReturnFlow, type PaymentReturnPhase } from '../lib/paymentReturnFlow'
import { fetchWebSessionMe } from '../lib/webAuth'

type PremiumSnapshot = { isPremium: boolean } | null

/**
 * Drives /premium?payment=return: confirms the stored WEB order on the server, then forces
 * a fresh /api/me. The flow keeps running after ?payment=return is stripped from the URL
 * and after a reload (the stored order is marked as returned), and stops only on unmount.
 */
export function usePaymentReturn(refreshPremium: () => Promise<PremiumSnapshot>): {
  phase: PaymentReturnPhase
  retry: () => void
} {
  const [searchParams, setSearchParams] = useSearchParams()
  const [phase, setPhase] = useState<PaymentReturnPhase>('idle')
  const mountedRef = useRef(true)
  const runningRef = useRef(false)
  const refreshRef = useRef(refreshPremium)
  refreshRef.current = refreshPremium
  const isReturn = searchParams.get('payment') === 'return'

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const run = useCallback(async () => {
    if (runningRef.current) return
    runningRef.current = true
    try {
      await runPaymentReturnFlow({
        readPending: () => readPendingWebPayment(),
        clearPending: clearPendingWebPayment,
        confirm: confirmWebPayment,
        currentAccountId: async () => {
          const me = await fetchWebSessionMe()
          return me?.webAccountId ? String(me.webAccountId) : null
        },
        refreshPremium: () => refreshRef.current(),
        sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
        isActive: () => mountedRef.current,
        onPhase: (p) => {
          if (mountedRef.current) setPhase(p)
        },
      })
    } finally {
      runningRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!isReturn) return
    try {
      sessionStorage.setItem('tcg_expecting_payment', String(Date.now()))
    } catch {
      /* ignore */
    }
    markPendingWebPaymentReturned()
    setSearchParams({}, { replace: true })
    void run()
  }, [isReturn, run, setSearchParams])

  // Reload after the return: ?payment=return is gone, the stored order says we came back.
  useEffect(() => {
    if (readPendingWebPayment()?.returnedAt) void run()
  }, [run])

  const retry = useCallback(() => {
    void run()
  }, [run])

  return { phase, retry }
}