import { lazy, Suspense, useCallback, useMemo, useState } from 'react'
import { LazyChunkErrorBoundary, LazyChunkLoadingShell, LazyChunkStatusShell } from './LazyChunkBoundary'
import { importPremiumOverlay } from './lazyChunkLoaders'

type Props = {
  isOpen: boolean
  onClose: () => void
}

/** Warm the paywall chunk before open (pointer/hover) without mounting UI. */
export function prefetchPremiumOverlay(): void {
  void importPremiumOverlay()
}

/**
 * Keeps the Premium paywall / checkout UI out of the cold-start JS+CSS graph.
 * Suspense covers pending downloads; LazyChunkErrorBoundary covers rejected chunks.
 */
export default function LazyPremiumOverlay(props: Props) {
  const [attempt, setAttempt] = useState(0)
  const PremiumOverlay = useMemo(
    () => lazy(() => importPremiumOverlay()),
    [attempt],
  )

  const retry = useCallback(() => {
    setAttempt((value) => value + 1)
  }, [])

  if (!props.isOpen) return null

  return (
    <LazyChunkErrorBoundary
      resetKey={attempt}
      fallback={() => (
        <LazyChunkStatusShell
          title="Premium"
          message="Не удалось загрузить экран подписки. Проверьте соединение и попробуйте снова."
          onRetry={retry}
          onClose={props.onClose}
        />
      )}
    >
      <Suspense
        fallback={
          <LazyChunkLoadingShell
            title="Загрузка Premium"
            message="Загрузка…"
            onClose={props.onClose}
          />
        }
      >
        <PremiumOverlay {...props} />
      </Suspense>
    </LazyChunkErrorBoundary>
  )
}
