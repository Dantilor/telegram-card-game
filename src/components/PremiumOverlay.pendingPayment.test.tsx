// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import PremiumOverlay from './PremiumOverlay'
import { LegalProvider } from '../legal/LegalProvider'
import { clearDocumentCache } from '../legal/documentCache'
import { readPendingWebPayment } from '../lib/pendingWebPayment'
import type { PublicDocument } from '../legal/types'

const shell = vi.hoisted(() => ({ web: true }))

vi.mock('../config/shell', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../config/shell')>()),
  isWebShell: () => shell.web,
}))
vi.mock('../shell/WebSessionContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../shell/WebSessionContext')>()),
  useWebSession: () => ({
    session: { webAccountId: 'acc-web-1', emailVerified: true, email: 'buyer@example.test' },
    status: 'ready',
    refresh: async () => undefined,
  }),
}))
vi.mock('../lib/telegram', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/telegram')>()),
  getInitData: () => 'test-session',
  ensureInitData: async () => 'test-session',
  getTelegramWebApp: () => null,
}))

const STATEMENT = 'Принимаю Публичную оферту Premium'
const PAYMENT_ID = '2c9a1b3d-000f-5000-9000-1abcdef01234'
const PLANS = [{ id: 'premium_1m', title: 'Premium на 1 месяц', priceRub: 259, durationDays: 30 }]

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

beforeEach(() => {
  clearDocumentCache()
  sessionStorage.clear()
  localStorage.clear()
  vi.stubEnv('VITE_API_URL', 'https://api.example.test')
  vi.stubEnv('VITE_API_BASE', '')
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes('/api/plans')) return json({ ok: true, plans: PLANS })
    if (url.endsWith('/api/legal/documents/offer')) return json(offer())
    if (url.endsWith('/api/legal/me')) return json({ agreement: null, consents: [], offerAcceptances: [] })
    if (url.endsWith('/api/legal/offer-acceptances') && init?.method === 'POST') return json({ evidenceId: 7 }, 201)
    if (url.endsWith('/api/payments/yookassa/create') && init?.method === 'POST') {
      return json({ confirmationUrl: 'https://yookassa.example/checkout', paymentId: PAYMENT_ID })
    }
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

async function buy() {
  render(
    <MemoryRouter initialEntries={['/premium']}>
      <LegalProvider>
        {shell.web ? <PremiumOverlay isOpen checkoutOnly preferredPlanId="premium_1m" onClose={() => undefined} /> : <PremiumOverlay isOpen onClose={() => undefined} />}
      </LegalProvider>
    </MemoryRouter>
  )
  await screen.findByText('259')
  fireEvent.click(await screen.findByRole('checkbox', { name: STATEMENT }))
  const mail = screen.queryByPlaceholderText('name@example.com')
  if (mail) fireEvent.change(mail, { target: { value: 'buyer@example.test' } })
  const button = screen.getByRole('button', { name: /Открыть Premium|Оплатить Premium/ })
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(button)
  await waitFor(() =>
    expect(fetchMock.mock.calls.some(([u, i]) => String(u).endsWith('/api/payments/yookassa/create') && i?.method === 'POST')).toBe(true)
  )
}

describe('PremiumOverlay remembers the WEB order before the YooKassa redirect', () => {
  it('WEB: stores paymentId + account id only, and creates a single payment', async () => {
    shell.web = true
    await buy()
    await waitFor(() => expect(readPendingWebPayment()?.paymentId).toBe(PAYMENT_ID))
    const pending = readPendingWebPayment()!
    expect(pending.accountId).toBe('acc-web-1')
    expect(JSON.stringify(Object.keys(pending).sort())).toBe(JSON.stringify(['accountId', 'createdAt', 'paymentId']))
    expect(fetchMock.mock.calls.filter(([u]) => String(u).endsWith('/api/payments/yookassa/create'))).toHaveLength(1)
  }, 20_000)

  it('Telegram Mini App: nothing is stored (payment creation unchanged)', async () => {
    shell.web = false
    await buy()
    await new Promise((resolve) => setTimeout(resolve, 200))
    expect(readPendingWebPayment()).toBeNull()
    expect(localStorage.getItem('gnh_web_pending_payment')).toBeNull()
    expect(sessionStorage.getItem('gnh_web_pending_payment')).toBeNull()
  }, 20_000)
})