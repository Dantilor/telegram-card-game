import { lazy, Suspense, useCallback, useMemo, useState } from 'react'
import { LazyChunkErrorBoundary, LazyChunkLoadingShell, LazyChunkStatusShell } from './LazyChunkBoundary'
import { importLegalDocumentModal } from './lazyChunkLoaders'
import { isChunkLoadError, safeReloadForStaleLazyChunk } from './lazyChunkRecovery'

type Props = {
  documentId: string
  version?: string
  onClose: () => void
}

export default function LazyLegalDocumentModal({ documentId, version, onClose }: Props) {
  const [attempt, setAttempt] = useState(0)
  const [lastError, setLastError] = useState<unknown>(null)
  const LegalDocumentModal = useMemo(() => lazy(() => importLegalDocumentModal()), [attempt])

  const retry = useCallback(() => {
    setLastError(null)
    setAttempt((value) => value + 1)
  }, [])

  const reload = useCallback(() => {
    safeReloadForStaleLazyChunk()
  }, [])

  const staleChunk = isChunkLoadError(lastError)

  return (
    <LazyChunkErrorBoundary
      resetKey={attempt}
      onError={setLastError}
      fallback={() => (
        <LazyChunkStatusShell
          title="Документ"
          message={
            staleChunk
              ? 'Не удалось загрузить документ: файлы приложения устарели или недоступны. Можно повторить или обновить приложение.'
              : 'Не удалось загрузить документ. Проверьте соединение и попробуйте снова.'
          }
          onRetry={retry}
          onReload={reload}
          onClose={onClose}
        />
      )}
    >
      <Suspense
        fallback={
          <LazyChunkLoadingShell
            title="Загрузка документа"
            message="Загрузка документа…"
            onClose={onClose}
          />
        }
      >
        <LegalDocumentModal documentId={documentId} version={version} onClose={onClose} />
      </Suspense>
    </LazyChunkErrorBoundary>
  )
}
