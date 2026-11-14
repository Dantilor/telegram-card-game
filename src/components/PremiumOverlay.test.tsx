// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import PremiumOverlay from './PremiumOverlay'
import { LegalProvider } from '../legal/LegalProvider'
import { clearDocumentCache } from '../legal/documentCache'
import type { PublicDocument } from '../legal/types'

vi.mock('../lib/telegram', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/telegram')>()),
  // Partial mock: ensureInitData keeps a binding to the real getInitData inside the module,
  // so both exports must be stubbed for Mini App payment tests.
  getInitData: () => 'test-session',
  ensureInitData: async () => 'test-session',
  getTelegramWebApp: () => null,
}))

const STATEMENT = 'Принимаю Публичную оферту Premium'
const PLANS = [
  { id: 'premium_1m', title: 'Premium на 1 месяц', priceRub: 259, durationDays: 30 },
  { id: 'premium_3m', title: 'Premium на 3 месяца', priceRub: 399, durationDays: 90 },
]

function offer(): PublicDocument {
  return {
    id: 'offer', title: 'Публичная оферта', version: '2026-10-20.1', sha256: 'a'.repeat(64), kind: 'offer', scope: 'checkout',
    documentDate: '2026-10-20', active: true, activatedAt: null, requiresIndividualDetails: false,
    confirmation: { available: true, mode: 'statement', statement: STATEMENT, channel: 'none' },
    links: { json: '', html: '', versionJson: '', versionHtml: '' }, versions: [],
    blocks: [{ type: 'paragraph', text: 'Текст оферты.' }],
  }
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
let fetchMock: Mock<(url: string, init?: RequestInit) => Promise<Response>>
let plansFailures = 0
let offerFailures = 0

function calls(path: string, method = 'GET') {
  return fetchMock.mock.calls.filter(([url, init]) => String(url).endsWith(path) && (init?.method ?? 'GET') === method).length
}

beforeEach(() => {
  plansFailures = 0
  offerFailures = 0
  clearDocumentCache()
  sessionStorage.clear()
  vi.stubEnv('VITE_API_URL', 'https://api.example.test')
  vi.stubEnv('VITE_API_BASE', '')
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/api/plans')) {
      if (plansFailures > 0) { plansFailures -= 1; throw new TypeError('Failed to fetch') }
      return json({ ok: true, plans: PLANS })
    }
    if (url.endsWith('/api/legal/documents/offer')) {
      if (offerFailures > 0) { offerFailures -= 1; throw new TypeError('Failed to fetch') }
      return json(offer())
    }
    if (url.endsWith('/api/legal/me')) return json({ agreement: null, consents: [], offerAcceptances: [] })
    if (url.endsWith('/api/legal/offer-acceptances') && init?.method === 'POST') return json({ evidenceId: 7 }, 201)
    if (url.endsWith('/api/payments/yookassa/create') && init?.method === 'POST') return json({ message: 'Платёжный сервис недоступен' }, 503)
    return json({})
  })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  clearDocumentCache()
})

function renderOverlay() {
  return render(<LegalProvider><PremiumOverlay isOpen onClose={() => undefined} /></LegalProvider>)
}

describe('PremiumOverlay recovery', () => {
  it('recovers plans and the offer on its own after a network outage, still requiring an explicit offer check', async () => {
    // Each loader exhausts its three quick GET attempts once, then the network returns.
    plansFailures = 3
    offerFailures = 3
    renderOverlay()

    await waitFor(() => expect(screen.getAllByText(/Восстанавливаем соединение/).length).toBe(2), { timeout: 5000 })
    expect(screen.getAllByRole('button', { name: 'Повторить сейчас' })).toHaveLength(2)

    await screen.findByText('259', undefined, { timeout: 8000 })
    const checkbox = await screen.findByRole('checkbox', { name: STATEMENT }, { timeout: 8000 })
    expect((checkbox as HTMLInputElement).checked).toBe(false)
    expect((checkbox as HTMLInputElement).disabled).toBe(false)
    expect(screen.queryByText(/Восстанавливаем соединение/)).toBeNull()
    expect(calls('/api/legal/offer-acceptances', 'POST')).toBe(0)
    expect(calls('/api/payments/yookassa/create', 'POST')).toBe(0)
  }, 20_000)

  it('keeps the entered email while the offer recovers', async () => {
    offerFailures = 3
    renderOverlay()
    const email = await screen.findByPlaceholderText('name@example.com')
    fireEvent.change(email, { target: { value: 'buyer@example.test' } })
    await screen.findByRole('checkbox', { name: STATEMENT }, { timeout: 8000 })
    expect((email as HTMLInputElement).value).toBe('buyer@example.test')
  }, 20_000)

  it('sends the payment POST once and never repeats it automatically after a failure', async () => {
    renderOverlay()
    await screen.findByText('259')
    fireEvent.click(await screen.findByRole('checkbox', { name: STATEMENT }))
    fireEvent.change(screen.getByPlaceholderText('name@example.com'), { target: { value: 'buyer@example.test' } })
    const buy = screen.getByRole('button', { name: /Открыть Premium/ })
    await waitFor(() => expect((buy as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(buy)

    await waitFor(() => expect(calls('/api/payments/yookassa/create', 'POST')).toBe(1))
    await new Promise((resolve) => setTimeout(resolve, 3_000))
    expect(calls('/api/payments/yookassa/create', 'POST')).toBe(1)
    expect(calls('/api/legal/offer-acceptances', 'POST')).toBe(1)
  }, 20_000)
})
