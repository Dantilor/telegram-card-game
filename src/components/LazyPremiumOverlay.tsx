import { lazy, Suspense, useCallback, useMemo, useState } from 'react'
import { LazyChunkErrorBoundary, LazyChunkLoadingShell, LazyChunkStatusShell } from './LazyChunkBoundary'
import { importPremiumOverlay } from './lazyChunkLoaders'
import { isChunkLoadError, safeReloadForStaleLazyChunk } from './lazyChunkRecovery'

type Props = {
  isOpen: boolean
  onClose: () => void
}

/** Warm the paywall chunk before open without mounting UI. Never leave a rejected Promise unhandled. */
export function prefetchPremiumOverlay(): void {
  void importPremiumOverlay().catch(() => undefined)
}

/**
 * Keeps the Premium paywall / checkout UI out of the cold-start JS+CSS graph.
 * Suspense covers pending downloads; LazyChunkErrorBoundary covers rejected chunks.
 */
export default function LazyPremiumOverlay(props: Props) {
  const [attempt, setAttempt] = useState(0)
  const [lastError, setLastError] = useState<unknown>(null)
  const PremiumOverlay = useMemo(
    () => lazy(() => importPremiumOverlay()),
    [attempt],
  )

  const retry = useCallback(() => {
    setLastError(null)
    setAttempt((value) => value + 1)
  }, [])

  const reload = useCallback(() => {
    safeReloadForStaleLazyChunk()
  }, [])

  if (!props.isOpen) return null

  const staleChunk = isChunkLoadError(lastError)

  return (
    <LazyChunkErrorBoundary
      resetKey={attempt}
      onError={setLastError}
      fallback={() => (
        <LazyChunkStatusShell
          title="Premium"
          message={
            staleChunk
              ? 'Не удалось загрузить экран подписки: файлы приложения устарели или недоступны. Можно повторить или обновить приложение (Telegram-авторизация сохранится).'
              : 'Не удалось загрузить экран подписки. Проверьте соединение и попробуйте снова.'
          }
          onRetry={retry}
          onReload={reload}
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
