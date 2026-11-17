// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import LazyPremiumOverlay from './LazyPremiumOverlay'
import { DeferredFirstUseSheet, consentPossiblyNeeded } from './DeferredFirstUseSheet'
import LazyLegalDocumentModal from './LazyLegalDocumentModal'

const legalState = vi.hoisted(() => ({
  status: 'ready' as 'loading' | 'ready' | 'anonymous' | 'error',
  records: { agreement: null as null | { active: boolean }, consents: [], offerAcceptances: [] },
}))

vi.mock('../legal/LegalProvider', () => {
  const Ctx = createContext({
    status: 'ready' as const,
    records: { agreement: null, consents: [], offerAcceptances: [] },
    error: null,
    refreshRecords: async () => undefined,
    openDocument: () => undefined,
    postLegal: async () => ({}),
  })
  return {
    useLegal: () => {
      const value = useContext(Ctx)
      return {
        ...value,
        status: legalState.status,
        records: legalState.records,
      }
    },
    LegalProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  }
})

const loaders = vi.hoisted(() => ({
  premium: vi.fn(),
  firstUse: vi.fn(),
  document: vi.fn(),
}))

vi.mock('./lazyChunkLoaders', () => ({
  importPremiumOverlay: () => loaders.premium(),
  importFirstUseSheet: () => loaders.firstUse(),
  importLegalDocumentModal: () => loaders.document(),
}))

function PremiumStub({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null
  return (
    <div role="dialog" aria-label="premium-ready">
      <button type="button" onClick={onClose}>
        close-premium
      </button>
    </div>
  )
}

function FirstUseStub() {
  return (
    <div role="dialog" aria-label="first-use-ready">
      Условия
      <button type="button">Позже</button>
    </div>
  )
}

function DocumentStub({ onClose }: { documentId: string; onClose: () => void }) {
  return (
    <div role="dialog" aria-label="document-ready">
      <button type="button" onClick={onClose}>
        close-doc
      </button>
    </div>
  )
}

beforeEach(() => {
  legalState.status = 'ready'
  legalState.records = { agreement: null, consents: [], offerAcceptances: [] }
  loaders.premium.mockReset()
  loaders.firstUse.mockReset()
  loaders.document.mockReset()
  loaders.premium.mockResolvedValue({ default: PremiumStub })
  loaders.firstUse.mockResolvedValue({ default: FirstUseStub })
  loaders.document.mockResolvedValue({ default: DocumentStub })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('consentPossiblyNeeded', () => {
  it('is false while loading or when agreement is active', () => {
    expect(consentPossiblyNeeded('loading', null)).toBe(false)
    expect(consentPossiblyNeeded('ready', { agreement: { active: true } })).toBe(false)
    expect(consentPossiblyNeeded('anonymous', null)).toBe(false)
    expect(consentPossiblyNeeded('error', null)).toBe(false)
  })

  it('is true when ready without an active agreement', () => {
    expect(consentPossiblyNeeded('ready', { agreement: null })).toBe(true)
    expect(consentPossiblyNeeded('ready', { agreement: { active: false } })).toBe(true)
  })
})

describe('LazyPremiumOverlay', () => {
  it('loads successfully and can be closed', async () => {
    const onClose = vi.fn()
    render(<LazyPremiumOverlay isOpen onClose={onClose} />)
    expect(await screen.findByLabelText('premium-ready')).toBeTruthy()
    fireEvent.click(screen.getByText('close-premium'))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows a loading shell while the chunk is slow', async () => {
    let resolveImport: ((value: { default: typeof PremiumStub }) => void) | undefined
    loaders.premium.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveImport = resolve
        }),
    )
    render(<LazyPremiumOverlay isOpen onClose={() => undefined} />)
    expect(await screen.findByLabelText('Загрузка Premium')).toBeTruthy()
    await act(async () => {
      resolveImport?.({ default: PremiumStub })
    })
    expect(await screen.findByLabelText('premium-ready')).toBeTruthy()
  })

  it('shows retry UI on chunk failure and recovers after retry', async () => {
    loaders.premium
      .mockRejectedValueOnce(new Error('chunk failed'))
      .mockResolvedValueOnce({ default: PremiumStub })
    render(<LazyPremiumOverlay isOpen onClose={() => undefined} />)
    expect(await screen.findByText('Не удалось загрузить экран подписки. Проверьте соединение и попробуйте снова.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }))
    expect(await screen.findByLabelText('premium-ready')).toBeTruthy()
  })

  it('allows closing from the error shell without granting Premium', async () => {
    loaders.premium.mockRejectedValue(new Error('chunk failed'))
    const onClose = vi.fn()
    render(<LazyPremiumOverlay isOpen onClose={onClose} />)
    await screen.findByText('Не удалось загрузить экран подписки. Проверьте соединение и попробуйте снова.')
    fireEvent.click(screen.getByText('Закрыть'))
    expect(onClose).toHaveBeenCalled()
  })
})

describe('DeferredFirstUseSheet', () => {
  it('does not mount while legal status is loading', () => {
    legalState.status = 'loading'
    render(<DeferredFirstUseSheet />)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(loaders.firstUse).not.toHaveBeenCalled()
  })

  it('does not mount when agreement is already active', () => {
    legalState.records = { agreement: { active: true }, consents: [], offerAcceptances: [] }
    render(<DeferredFirstUseSheet />)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(loaders.firstUse).not.toHaveBeenCalled()
  })

  it('shows a blocking loading gate immediately when consent is needed', async () => {
    let resolveImport: ((value: { default: typeof FirstUseStub }) => void) | undefined
    loaders.firstUse.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveImport = resolve
        }),
    )
    render(<DeferredFirstUseSheet />)
    expect(await screen.findByLabelText('Загрузка условий использования')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Закрыть' })).toBeNull()
    await act(async () => {
      resolveImport?.({ default: FirstUseStub })
    })
    expect(await screen.findByLabelText('first-use-ready')).toBeTruthy()
  })

  it('keeps a blocking retry shell on chunk failure (no close bypass)', async () => {
    loaders.firstUse
      .mockRejectedValueOnce(new Error('legal chunk failed'))
      .mockResolvedValueOnce({ default: FirstUseStub })
    render(<DeferredFirstUseSheet />)
    expect(
      await screen.findByText(
        'Не удалось загрузить обязательные условия. Повторите загрузку — без этого продолжить нельзя.',
      ),
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Закрыть' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }))
    expect(await screen.findByLabelText('first-use-ready')).toBeTruthy()
  })
})

describe('LazyLegalDocumentModal', () => {
  it('shows a loading shell immediately, then the document', async () => {
    let resolveImport: ((value: { default: typeof DocumentStub }) => void) | undefined
    loaders.document.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveImport = resolve
        }),
    )
    const onClose = vi.fn()
    render(<LazyLegalDocumentModal documentId="privacy" onClose={onClose} />)
    expect(await screen.findByLabelText('Загрузка документа')).toBeTruthy()
    await act(async () => {
      resolveImport?.({ default: DocumentStub })
    })
    expect(await screen.findByLabelText('document-ready')).toBeTruthy()
  })

  it('retries after a failed document chunk', async () => {
    loaders.document
      .mockRejectedValueOnce(new Error('doc chunk failed'))
      .mockResolvedValueOnce({ default: DocumentStub })
    render(<LazyLegalDocumentModal documentId="privacy" onClose={() => undefined} />)
    expect(await screen.findByText('Не удалось загрузить документ. Проверьте соединение и попробуйте снова.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }))
    expect(await screen.findByLabelText('document-ready')).toBeTruthy()
  })
})

describe('loading → ready transition', () => {
  it('opens the gate in the same update when status becomes ready without agreement', async () => {
    legalState.status = 'loading'
    function Harness() {
      const [, setTick] = useState(0)
      const api = useMemo(
        () => ({
          flip: () => {
            legalState.status = 'ready'
            legalState.records = { agreement: null, consents: [], offerAcceptances: [] }
            setTick((value) => value + 1)
          },
        }),
        [],
      )
      return (
        <div>
          <button type="button" onClick={api.flip}>
            flip-ready
          </button>
          <DeferredFirstUseSheet />
        </div>
      )
    }

    let resolveImport: ((value: { default: typeof FirstUseStub }) => void) | undefined
    loaders.firstUse.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveImport = resolve
        }),
    )

    render(<Harness />)
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByText('flip-ready'))
    expect(await screen.findByLabelText('Загрузка условий использования')).toBeTruthy()
    await act(async () => {
      resolveImport?.({ default: FirstUseStub })
    })
    await waitFor(() => expect(screen.getByLabelText('first-use-ready')).toBeTruthy())
  })
})
