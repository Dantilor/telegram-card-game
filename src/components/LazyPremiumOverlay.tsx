import { lazy, Suspense, useEffect, type ComponentProps } from 'react'
import { createPortal } from 'react-dom'

const PremiumOverlay = lazy(() => import('./PremiumOverlay'))

type Props = ComponentProps<typeof PremiumOverlay>

/** Warm the paywall chunk before open (pointer/hover) without mounting UI. */
export function prefetchPremiumOverlay(): void {
  void import('./PremiumOverlay')
}

function PremiumOverlayLoadingShell({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  return createPortal(
    <div
      className="premium-overlay-loading"
      role="dialog"
      aria-modal="true"
      aria-busy="true"
      aria-label="Загрузка Premium"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(8, 10, 20, 0.55)',
      }}
    >
      <button
        type="button"
        aria-label="Закрыть"
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          border: 0,
          background: 'transparent',
          cursor: 'pointer',
        }}
      />
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          minWidth: '12rem',
          padding: '1rem 1.25rem',
          borderRadius: '1rem',
          background: 'rgba(20, 22, 36, 0.92)',
          color: '#f5f5f7',
          font: '600 0.95rem Manrope, system-ui, sans-serif',
          textAlign: 'center',
        }}
      >
        Загрузка…
      </div>
    </div>,
    document.body,
  )
}

/**
 * Keeps the Premium paywall / checkout UI out of the cold-start JS+CSS graph.
 * The chunk downloads only when the overlay is first opened (or prefetched).
 * A blocking shell avoids a “dead tap” / blank gap on slow networks.
 */
export default function LazyPremiumOverlay(props: Props) {
  if (!props.isOpen) return null
  return (
    <Suspense fallback={<PremiumOverlayLoadingShell onClose={props.onClose} />}>
      <PremiumOverlay {...props} />
    </Suspense>
  )
}
