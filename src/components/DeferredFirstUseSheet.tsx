import { lazy, Suspense, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLegal } from '../legal/LegalProvider'

const FirstUseSheet = lazy(() =>
  import('./LegalChoices').then((module) => ({ default: module.FirstUseSheet })),
)

function consentPossiblyNeeded(
  status: ReturnType<typeof useLegal>['status'],
  records: ReturnType<typeof useLegal>['records'],
): boolean {
  return status === 'ready' && records?.agreement?.active !== true
}

function FirstUseLoadingGate() {
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  return createPortal(
    <div
      className="legal-choice legal-overlay"
      role="dialog"
      aria-modal="true"
      aria-busy="true"
      aria-label="Загрузка условий использования"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        background: 'rgba(8, 10, 20, 0.45)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '28rem',
          margin: '0 auto',
          padding: '1.25rem 1.25rem max(1.25rem, env(safe-area-inset-bottom))',
          borderRadius: '1.25rem 1.25rem 0 0',
          background: '#12141f',
          color: '#f5f5f7',
          font: '600 1rem Manrope, system-ui, sans-serif',
          textAlign: 'center',
        }}
      >
        Загрузка условий…
      </div>
    </div>,
    document.body,
  )
}

/**
 * Mandatory consent UI stays intact. LegalChoices is downloaded only when
 * an unsigned agreement may need the sheet. A blocking gate covers the chunk
 * download so Home cannot be used through a silent gap on slow networks.
 */
export function DeferredFirstUseSheet() {
  const legal = useLegal()
  const needsConsent = consentPossiblyNeeded(legal.status, legal.records)
  const [shouldLoad, setShouldLoad] = useState(needsConsent)

  useEffect(() => {
    if (needsConsent) setShouldLoad(true)
  }, [needsConsent])

  if (!shouldLoad) return null

  return (
    <Suspense fallback={needsConsent ? <FirstUseLoadingGate /> : null}>
      <FirstUseSheet />
    </Suspense>
  )
}
