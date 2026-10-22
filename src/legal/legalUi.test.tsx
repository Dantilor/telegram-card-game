// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { FirstUseSheet, ConsentsPanel } from '../components/LegalChoices'
import { LegalDocumentModal } from '../components/LegalDocumentView'
import { LegalProvider, useLegal } from './LegalProvider'
import { cachedDocument, clearDocumentCache, invalidateDocument, loadDocument } from './documentCache'
import { isAnalyticsTransportAllowed } from './analyticsGate'
import { LegalClientError, submitNewPremiumOrder } from './client'
import type { OwnLegalRecords, PublicDocument } from './types'

vi.mock('../lib/telegram', () => ({ getInitData: () => 'test-session' }))

function publicDocument(id: string, version = '2026-10-20.1'): PublicDocument {
  return {
    id, title: `Документ ${id}`, version, sha256: 'a'.repeat(64), kind: 'test', scope: 'test',
    documentDate: '2026-10-20', active: true, activatedAt: null, requiresIndividualDetails: false,
    confirmation: { available: true, mode: 'accepted_boolean', statement: null },
    links: { json: '', html: '', versionJson: '', versionHtml: '' }, versions: [],
    blocks: [{ type: 'heading', level: 1, text: `Полный текст ${id}` }, { type: 'paragraph', text: 'Официальный текст документа.' }],
  }
}
let records: OwnLegalRecords
let fetchMock: Mock<(url: string, init?: RequestInit) => Promise<Response>>
const backHandlers = new Set<() => void>()

function Status() { return <span>{useLegal().status}</span> }
function App() { return <LegalProvider><Status /><FirstUseSheet /><ConsentsPanel /></LegalProvider> }
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status }) }

beforeEach(() => {
  records = { agreement: null, consents: [], offerAcceptances: [] }
  sessionStorage.clear()
  clearDocumentCache()
  backHandlers.clear()
  vi.stubEnv('VITE_API_URL', 'https://api.example.test')
  vi.stubEnv('VITE_API_BASE', '')
  vi.stubGlobal('Telegram', undefined)
  Object.defineProperty(window, 'Telegram', { configurable: true, value: { WebApp: { BackButton: {
    show: vi.fn(), hide: vi.fn(),
    onClick: (callback: () => void) => backHandlers.add(callback),
    offClick: (callback: () => void) => backHandlers.delete(callback),
  } } } })
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/api/legal/me')) return json(records)
    if (url.endsWith('/api/legal/agreement') && init?.method === 'POST') {
      records.agreement = { state: 'accepted', active: true, version: '2026-10-20.1', sha256: 'a'.repeat(64), grantedAt: '2026-10-22', term: '' }
      return json({ evidenceId: 1 }, 201)
    }
    const match = url.match(/\/documents\/([^/]+)/)
    if (match) return json(publicDocument(match[1]))
    return json({})
  })
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); clearDocumentCache() })

describe('first-use agreement', () => {
  it('does not open accepted terms when there is no analytics consent', async () => {
    records.agreement = { state: 'accepted', active: true, version: 'v1', sha256: '', grantedAt: null, term: '' }
    render(<App />)
    await screen.findByText('ready')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/documents/analytics'))).toBe(false)
  })

  it('closes immediately after a confirmed POST, even if the subsequent refresh is slow', async () => {
    let reads = 0
    let finishPost: (() => void) | undefined
    const defaultFetch = fetchMock.getMockImplementation()!
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url.endsWith('/api/legal/me') && ++reads > 1) return new Promise(() => {})
      if (url.endsWith('/api/legal/agreement')) return new Promise<Response>((resolve) => { finishPost = () => resolve(json({ evidenceId: 1 }, 201)) })
      return defaultFetch(url, init)
    })
    render(<App />)
    const accept = await screen.findByRole('button', { name: 'Принимаю соглашение' })
    await waitFor(() => expect((accept as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(accept)
    fireEvent.click(accept)
    expect(screen.queryByRole('dialog')).not.toBeNull()
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/api/legal/agreement'))).toHaveLength(1)
    await act(async () => finishPost?.())
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('keeps the sheet open on a failed save and does not remember acceptance', async () => {
    const defaultFetch = fetchMock.getMockImplementation()!
    fetchMock.mockImplementation((url: string, init?: RequestInit) => url.endsWith('/api/legal/agreement') ? Promise.resolve(json({ message: 'Ошибка сохранения' }, 503)) : defaultFetch(url, init))
    render(<App />)
    const accept = await screen.findByRole('button', { name: 'Принимаю соглашение' })
    await waitFor(() => expect((accept as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(accept)
    await screen.findByRole('alert')
    expect(screen.queryByRole('dialog')).not.toBeNull()
    expect(sessionStorage.getItem('gnh_legal_sheet_closed')).toBeNull()
  })

  it('stays dismissed in a new session when the server has stored acceptance', async () => {
    const mounted = render(<App />)
    const accept = await screen.findByRole('button', { name: 'Принимаю соглашение' })
    await waitFor(() => expect((accept as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(accept)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    mounted.unmount()
    sessionStorage.clear()
    render(<App />)
    await screen.findByText('ready')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('native Back closes only the document and keeps the first-use sheet open', async () => {
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Пользовательское соглашение' }))
    await screen.findByRole('heading', { name: 'Условия использования' })
    expect(backHandlers.size).toBe(1)
    await act(async () => { [...backHandlers].forEach((callback) => callback()) })
    expect(screen.queryByRole('heading', { name: 'Условия использования' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Перед началом игры' })).not.toBeNull()
    expect(sessionStorage.getItem('gnh_legal_sheet_closed')).toBeNull()
  })

  it('does not resume analytics for an old active grant or show unused opt-ins', async () => {
    records.consents = [{ documentId: 'analytics', channel: null, state: 'granted', active: true, version: 'v1', sha256: '', grantedAt: null, validUntil: null, withdrawnAt: null, inactiveReason: null, term: '' }]
    render(<App />)
    await screen.findByText('ready')
    expect(isAnalyticsTransportAllowed()).toBe(false)
    expect(screen.queryByRole('button', { name: 'Разрешить аналитику' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Подтвердить рекламную подписку в Telegram' })).toBeNull()
    expect(screen.queryByText('Настройки приватности')).not.toBeNull()
  })
})

describe('document cache and reader', () => {
  it('deduplicates concurrent public reads, caches text, and refetches after invalidation', async () => {
    const loaded = await Promise.all([loadDocument('privacy'), loadDocument('privacy')])
    expect(loaded[0]).toBe(loaded[1])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await loadDocument('privacy')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    invalidateDocument('privacy')
    await loadDocument('privacy')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [, init] = fetchMock.mock.calls[0]
    expect(init?.headers).not.toHaveProperty('x-telegram-init-data')
  })

  it('does not cache failed requests', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'))
    await expect(loadDocument('privacy')).rejects.toThrow()
    expect(cachedDocument('privacy')).toBeNull()
    await loadDocument('privacy')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('refreshes active text after expiry while keeping an explicitly requested version cached', async () => {
    const now = Date.now()
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now)
    await loadDocument('privacy')
    clock.mockReturnValue(now + 5 * 60_000 + 1)
    await loadDocument('privacy', '2026-10-20.1')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await loadDocument('privacy')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('recovers a failed document without dismissing the reader or accepting anything', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'))
    const close = vi.fn()
    render(<LegalDocumentModal documentId="privacy" onClose={close} />)
    await screen.findByRole('heading', { name: 'Документ не загрузился' })
    fireEvent.click(screen.getByRole('button', { name: 'Повторить загрузку' }))
    await screen.findByRole('heading', { name: 'Полный текст privacy' })
    expect(close).not.toHaveBeenCalled()
    expect(fetchMock.mock.calls.every(([, init]) => init?.method === 'GET')).toBe(true)
  })

  it('preserves a version mismatch so checkout can refresh the offer before creating a payment', async () => {
    const offer = publicDocument('offer')
    offer.confirmation = { available: true, mode: 'statement', statement: 'Принимаю оферту', channel: 'none' }
    const post = vi.fn(async () => { throw new LegalClientError('version_mismatch', 409, 'Редакция обновилась') })
    await expect(submitNewPremiumOrder({
      document: offer, plan: { id: 'premium_1m', title: 'Месяц', priceRub: 259, durationDays: 30 },
      receiptRaw: 'test@example.test', post,
    })).rejects.toMatchObject({ code: 'version_mismatch' })
    expect(post).toHaveBeenCalledTimes(1)
  })

  it('renders preloaded text immediately without technical hashes or a loading placeholder', async () => {
    fetchMock.mockResolvedValueOnce(json({ ...publicDocument('privacy'), documentDate: 'Tue Oct 20' }))
    await loadDocument('privacy')
    render(<LegalDocumentModal documentId="privacy" onClose={() => {}} />)
    expect(screen.queryByRole('heading', { name: 'Полный текст privacy' })).not.toBeNull()
    expect(screen.queryByRole('status', { name: 'Загрузка документа' })).toBeNull()
    expect(document.body.textContent).not.toContain('SHA-256')
    expect(document.body.textContent).not.toContain('2026-10-20.1')
    expect(screen.queryByText(/Редакция от 20 октября 2026/)).not.toBeNull()
  })
})
