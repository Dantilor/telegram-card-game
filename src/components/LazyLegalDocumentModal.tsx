import { lazy, Suspense, useCallback, useMemo, useState } from 'react'
import { LazyChunkErrorBoundary, LazyChunkLoadingShell, LazyChunkStatusShell } from './LazyChunkBoundary'
import { importLegalDocumentModal } from './lazyChunkLoaders'

type Props = {
  documentId: string
  version?: string
  onClose: () => void
}

export default function LazyLegalDocumentModal({ documentId, version, onClose }: Props) {
  const [attempt, setAttempt] = useState(0)
  const LegalDocumentModal = useMemo(() => lazy(() => importLegalDocumentModal()), [attempt])
  const retry = useCallback(() => setAttempt((value) => value + 1), [])

  return (
    <LazyChunkErrorBoundary
      resetKey={attempt}
      fallback={() => (
        <LazyChunkStatusShell
          title="Документ"
          message="Не удалось загрузить документ. Проверьте соединение и попробуйте снова."
          onRetry={retry}
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
