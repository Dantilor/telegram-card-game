import { lazy, Suspense, useCallback, useMemo, useState } from 'react'
import { useLegal } from '../legal/LegalProvider'
import { LazyChunkErrorBoundary, LazyChunkLoadingShell, LazyChunkStatusShell } from './LazyChunkBoundary'
import { importFirstUseSheet } from './lazyChunkLoaders'
import { isChunkLoadError, safeReloadForStaleLazyChunk } from './lazyChunkRecovery'

export function consentPossiblyNeeded(
  status: 'loading' | 'ready' | 'anonymous' | 'error',
  records: { agreement?: { active?: boolean } | null } | null,
): boolean {
  return status === 'ready' && records?.agreement?.active !== true
}

/**
 * Mandatory consent UI stays intact. LegalChoices downloads only when an
 * unsigned agreement may need the sheet. Gate renders synchronously with
 * needsConsent. Chunk errors stay blocking — retry or guarded app reload only.
 */
export function DeferredFirstUseSheet() {
  const legal = useLegal()
  const needsConsent = consentPossiblyNeeded(legal.status, legal.records)
  const [attempt, setAttempt] = useState(0)
  const [lastError, setLastError] = useState<unknown>(null)
  const FirstUseSheet = useMemo(() => lazy(() => importFirstUseSheet()), [attempt])

  const retry = useCallback(() => {
    setLastError(null)
    setAttempt((value) => value + 1)
  }, [])

  const reload = useCallback(() => {
    safeReloadForStaleLazyChunk()
  }, [])

  if (!needsConsent) return null

  const staleChunk = isChunkLoadError(lastError)

  return (
    <LazyChunkErrorBoundary
      resetKey={attempt}
      onError={setLastError}
      fallback={() => (
        <LazyChunkStatusShell
          title="Условия использования"
          message={
            staleChunk
              ? 'Не удалось загрузить обязательные условия: файлы приложения устарели или недоступны. Повторите или обновите приложение — без условий продолжить нельзя.'
              : 'Не удалось загрузить обязательные условия. Повторите загрузку — без этого продолжить нельзя.'
          }
          onRetry={retry}
          onReload={reload}
          blocking
        />
      )}
    >
      <Suspense
        fallback={
          <LazyChunkLoadingShell
            title="Загрузка условий использования"
            message="Загрузка условий…"
            blocking
          />
        }
      >
        <FirstUseSheet />
      </Suspense>
    </LazyChunkErrorBoundary>
  )
}
