/** @vitest-environment jsdom */
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import PremiumOverlay from './PremiumOverlay'
import { LegalProvider } from '../legal/LegalProvider'
import { clearDocumentCache } from '../legal/documentCache'
import type { PublicDocument } from '../legal/types'

vi.mock('../config/shell', async (importOriginal) => {
  const real = await importOriginal<typeof import('../config/shell')>()
  return { ...real, isWebShell: () => true, getShell: () => 'web' as const }
})

vi.mock('../lib/telegram', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/telegram')>()),
  getInitData: () => '',
  ensureInitData: async () => '',
  getTelegramWebApp: () => null,
}))

const STATEMENT = 'Принимаю Публичную оферту Premium'
const PLAN = { id: 'premium_web_1m', title: 'Premium на 30 дней', priceRub: 259, durationDays: 30, audience: 'web' }

function offer(): PublicDocument {
  return {
    id: 'offer', title: 'Публичная оферта', version: '2026-10-20.1', sha256: 'a'.repeat(64), kind: 'offer', scope: 'checkout',
    documentDate: '2026-10-20', active: true, activatedAt: null, requiresIndividualDetails: false,
    confirmation: { available: true, mode: 'statement', statement: STATEMENT, channel: 'none' },
    links: { json: '', html: '', versionJson: '', versionHtml: '' }, versions: [],
    blocks: [{ type: 'paragraph', text: 'Текст оферты.' }],
  }
}

let fetchMock: Mock<(url: string, init?: RequestInit) => Promise<Response>>
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

beforeEach(() => {
  clearDocumentCache()
  document.documentElement.setAttribute('data-gnh-shell', 'web')
  vi.stubEnv('VITE_API_URL', 'https://api.example.test')
  vi.stubEnv('VITE_API_BASE', '')
  fetchMock = vi.fn(async (url: string) => {
    if (String(url).includes('/api/plans')) return json({ ok: true, plans: [PLAN] })
    if (String(url).includes('/api/legal/documents/offer')) return json(offer())
    if (String(url).includes('/api/legal/me')) return json({ agreement: null, consents: [], offerAcceptances: [] })
    return json({})
  })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  clearDocumentCache()
  document.documentElement.removeAttribute('data-gnh-shell')
})

describe('Premium checkout layout structure', () => {
  it('keeps pay dock outside the scroll region', async () => {
    render(
      <MemoryRouter>
        <LegalProvider>
          <PremiumOverlay
            isOpen
            onClose={() => undefined}
            checkoutOnly
            preferredPlanId={PLAN.id}
            preferredPlan={PLAN}
          />
        </LegalProvider>
      </MemoryRouter>,
    )

    const checkout = await screen.findByTestId('premium-checkout')
    const scroll = await screen.findByTestId('premium-checkout-scroll')
    await screen.findByRole('heading', { name: /Оформление Premium/i })
    await waitFor(() => expect(screen.getByText('259')).toBeTruthy())
    const buy = await screen.findByRole('button', { name: /Оплатить Premium/i })
    const emailLogin = await screen.findByRole('button', { name: /Войти по email/i })
    const dock = checkout.querySelector('.premium-overlay__dock--checkout')
    expect(dock).toBeTruthy()
    expect(scroll.contains(dock as Node)).toBe(false)
    expect(scroll.contains(buy)).toBe(false)
    expect(scroll.contains(emailLogin)).toBe(false)
    expect(screen.getByPlaceholderText('name@example.com')).toBeTruthy()
  })
})