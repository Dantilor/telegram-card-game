import { lazy, Suspense, useCallback, useMemo, useState } from 'react'
import { useLegal } from '../legal/LegalProvider'
import { LazyChunkErrorBoundary, LazyChunkLoadingShell, LazyChunkStatusShell } from './LazyChunkBoundary'
import { importFirstUseSheet } from './lazyChunkLoaders'

export function consentPossiblyNeeded(
  status: 'loading' | 'ready' | 'anonymous' | 'error',
  records: { agreement?: { active?: boolean } | null } | null,
): boolean {
  return status === 'ready' && records?.agreement?.active !== true
}

/**
 * Mandatory consent UI stays intact. LegalChoices downloads only when an
 * unsigned agreement may need the sheet. Gate renders synchronously with
 * `needsConsent` (no useEffect frame gap). Chunk errors stay blocking — retry only.
 */
export function DeferredFirstUseSheet() {
  const legal = useLegal()
  const needsConsent = consentPossiblyNeeded(legal.status, legal.records)
  const [attempt, setAttempt] = useState(0)
  const FirstUseSheet = useMemo(() => lazy(() => importFirstUseSheet()), [attempt])

  const retry = useCallback(() => {
    setAttempt((value) => value + 1)
  }, [])

  if (!needsConsent) return null

  return (
    <LazyChunkErrorBoundary
      resetKey={attempt}
      fallback={() => (
        <LazyChunkStatusShell
          title="Условия использования"
          message="Не удалось загрузить обязательные условия. Повторите загрузку — без этого продолжить нельзя."
          onRetry={retry}
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
