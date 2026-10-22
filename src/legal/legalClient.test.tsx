import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { LegalBlocks } from '../components/LegalBlocks'
import {
  allowAnalyticsTransport,
  blockAnalyticsTransport,
  canSendAnalytics,
  discardedEventNames,
  isAnalyticsTransportAllowed,
  resetAnalyticsGate,
  resolveAnalyticsTransport,
  shouldSendInitialAppOpen,
} from './analyticsGate'
import { resolveApiBase } from '../lib/apiBase'
import { getBaseUrl } from '../lib/api'
import {
  buildLegalRequest,
  buildPaymentBody,
  classifyReceipt,
  fetchPublicDocument,
  legalApiBase,
  LegalClientError,
  submitNewPremiumOrder,
  userFacingLoadError,
} from './client'
import { trackEvent } from '../lib/analytics'

const root = join(process.cwd(), 'src')

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path, acc)
    else if (/\.(ts|tsx|js|css)$/.test(name) && !/\.test\./.test(name)) acc.push(path)
  }
  return acc
}

describe('public documents', () => {
  it('reads a document without initData, user id, or account creation', () => {
    const request = buildLegalRequest({
      base: 'https://api.example.test',
      path: '/api/legal/documents/privacy',
      method: 'GET',
      publicRead: true,
      initData: 'hash=secret&user=%7B%22id%22%3A1%7D',
    })
    expect(request.url).toBe('https://api.example.test/api/legal/documents/privacy')
    expect(request.url).not.toContain('secret')
    expect(request.init.headers).not.toHaveProperty('x-telegram-init-data')
    expect(request.init.body).toBeUndefined()
  })

  it('does not replace a failed document with a short text', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: 'document_unavailable', message: 'Утверждённый текст документа недоступен. Подтверждение не сохранено.' }), { status: 503 }))
    await expect(fetchPublicDocument('privacy', undefined, { VITE_API_URL: 'https://api.example.test' }, fetchImpl)).rejects.toMatchObject({
      code: 'http_503',
    })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('refuses the Render fallback for legal calls', () => {
    expect(() => legalApiBase({})).toThrow(LegalClientError)
    expect(() => legalApiBase({ VITE_API_URL: 'https://telegram-card-game.onrender.com' })).toThrow(/Timeweb|Прежний адрес/)
  })

  it('uses one API origin and does not call Render when it is missing', () => {
    expect(() => resolveApiBase({})).toThrow(/не задан/)
    expect(() => resolveApiBase({ VITE_API_URL: 'https://telegram-card-game.onrender.com' })).toThrow(/Render/)
    expect(() =>
      resolveApiBase({ VITE_API_URL: 'https://api.example.test', VITE_API_BASE: 'https://other.example.test' })
    ).toThrow(/разные серверы/)
    expect(resolveApiBase({ VITE_API_URL: 'https://api.example.test', VITE_API_BASE: 'https://api.example.test' })).toBe(
      'https://api.example.test'
    )
    expect(resolveApiBase({ VITE_API_BASE: 'http://localhost:3001' })).toBe('http://localhost:3001')
    vi.stubEnv('VITE_API_URL', '')
    vi.stubEnv('VITE_API_BASE', '')
    expect(() => getBaseUrl()).toThrow(/не задан/)
    vi.stubEnv('VITE_API_URL', 'https://api.example.test')
    expect(getBaseUrl()).toBe('https://api.example.test')
    const apiSource = readFileSync(join(process.cwd(), 'src/lib/api.ts'), 'utf8')
    const otherSource = readFileSync(join(process.cwd(), 'src/api/client.ts'), 'utf8')
    const hidden = userFacingLoadError(new LegalClientError('api_not_configured', 0, 'Адрес API не задан. Подтверждение не отправлено.'), false)
    expect(hidden.includes('VITE_')).toBe(false)
    expect(hidden.includes('Адрес API')).toBe(false)
    expect(hidden.includes('Подтверждение не отправлено')).toBe(true)
    expect(apiSource.includes('onrender.com')).toBe(false)
    expect(otherSource.includes('onrender.com')).toBe(false)
    vi.unstubAllEnvs()
  })
})

describe('analytics consent', () => {
  beforeEach(() => {
    resetAnalyticsGate()
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 202 })))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('does not send app_open before a server consent and does not replay it later', () => {
    vi.stubEnv('VITE_API_URL', 'https://api.example.test')
    trackEvent('app_open')
    expect(fetch).not.toHaveBeenCalled()
    expect(discardedEventNames()).toContain('app_open')
    expect(shouldSendInitialAppOpen(false, true)).toBe(false)
    allowAnalyticsTransport()
    expect(discardedEventNames()).toEqual([])
    expect(fetch).not.toHaveBeenCalled()
    trackEvent('start_game', { gameId: 'card', note: 'секрет переписки' })
    const calls = vi.mocked(fetch).mock.calls
    expect(calls).toHaveLength(1)
    const body = JSON.parse(String((calls[0][1] as RequestInit).body))
    expect(body).toEqual({ name: 'start_game', props: { gameId: 'card' } })
    expect(JSON.stringify(body)).not.toContain('секрет')
  })

  it('keeps analytics off when localStorage claims consent but the server does not', () => {
    expect(resolveAnalyticsTransport(false, true)).toBe(false)
    expect(isAnalyticsTransportAllowed()).toBe(false)
    expect(canSendAnalytics('app_open')).toBe(false)
  })

  it('turns analytics off after withdrawal even if another screen had it enabled', () => {
    allowAnalyticsTransport()
    expect(isAnalyticsTransportAllowed()).toBe(true)
    blockAnalyticsTransport()
    expect(canSendAnalytics('open_deck')).toBe(false)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('does not send an event after the server term has expired', () => {
    vi.stubEnv('VITE_API_URL', 'https://api.example.test')
    allowAnalyticsTransport(new Date(Date.now() - 1000).toISOString())
    trackEvent('app_open')
    expect(fetch).not.toHaveBeenCalled()
    expect(isAnalyticsTransportAllowed()).toBe(false)
  })
})

describe('premium purchase', () => {
  const document = {
    id: 'offer',
    title: 'Оферта',
    version: '2026-10-20.1',
    sha256: 'a'.repeat(64),
    kind: 'contract_acceptance',
    scope: 'checkout',
    documentDate: '2026-10-20',
    requiresIndividualDetails: false,
    active: true,
    activatedAt: null,
    confirmation: { available: true as const, mode: 'statement' as const, statement: 'Принимаю Публичную оферту Premium', channel: 'none' as const },
    links: { json: '/api/legal/documents/offer', html: '/legal/documents/offer', versionJson: '/x', versionHtml: '/y' },
    versions: [],
    blocks: [{ type: 'paragraph' as const, text: 'FICTIONAL CHECKOUT TEXT' }],
  }

  it('rejects a placeholder receipt and does not create an order', async () => {
    const post = vi.fn()
    await expect(submitNewPremiumOrder({
      document,
      plan: { id: 'premium_1m', title: '1 месяц', priceRub: 259, durationDays: 30 },
      receiptRaw: '100@gamenight.local',
      post,
    })).rejects.toMatchObject({ code: 'receipt_contact_invalid' })
    expect(post).not.toHaveBeenCalled()
    expect(classifyReceipt('  buyer@example.com  ')).toEqual({ email: 'buyer@example.com' })
    expect(classifyReceipt('')).toEqual({ error: 'Для чека укажите email.' })
    expect(classifyReceipt('not-an-email')).toMatchObject({ error: expect.stringContaining('email') })
  })

  it('does not start an order when the receipt is a phone', async () => {
    const post = vi.fn()
    await expect(submitNewPremiumOrder({
      document,
      plan: { id: 'premium_1m', title: '1 месяц', priceRub: 259, durationDays: 30 },
      receiptRaw: '+7 (999) 123-45-67',
      post,
    })).rejects.toMatchObject({ code: 'receipt_contact_invalid' })
    expect(post).not.toHaveBeenCalled()
  })

  it('does not create a payment when offer acceptance is not stored', async () => {
    const post = vi.fn(async () => {
      throw new LegalClientError('network', 0, 'Нет соединения. Подтверждение не сохранено.')
    })
    await expect(submitNewPremiumOrder({
      document,
      plan: { id: 'premium_1m', title: '1 месяц', priceRub: 259, durationDays: 30 },
      receiptRaw: 'buyer@example.com',
      post,
    })).rejects.toThrow(/не сохранено/)
    expect(post).toHaveBeenCalledTimes(1)
    expect(post.mock.calls[0][0]).toBe('/api/legal/offer-acceptances')
  })

  it('links a new order to the accepted offer and leaves restore independent', async () => {
    const post = vi.fn(async (path: string) => {
      if (path === '/api/legal/offer-acceptances') return { evidenceId: 15 }
      return { confirmationUrl: 'https://yookassa.example/pay' }
    })
    const result = await submitNewPremiumOrder({
      document,
      plan: { id: 'premium_3m', title: '3 месяца', priceRub: 399, durationDays: 90 },
      receiptRaw: '  buyer@example.com  ',
      post,
    })
    expect(result.confirmationUrl).toMatch(/^https:\/\//)
    const payment = buildPaymentBody('premium_3m', 15, { email: 'buyer@example.com' })
    expect(payment).toEqual({ planId: 'premium_3m', offerAcceptanceId: 15, email: 'buyer@example.com' })
    expect(payment).not.toHaveProperty('phone')
    expect(payment).not.toHaveProperty('marketing')
    expect(payment).not.toHaveProperty('analytics')
    expect(post.mock.calls[1][1]).toEqual(payment)
    const overlay = readFileSync(join(root, 'components/PremiumOverlay.tsx'), 'utf8')
    expect(overlay).toContain('Email для чека')
    expect(overlay).toContain('type="email"')
    expect(overlay).toContain('ЮKassa отправит чек на эту почту.')
    expect(overlay).not.toContain('+79990000000')
    const restore = overlay.slice(overlay.indexOf('const handleRestorePurchase'), overlay.indexOf('const handleBackdropClick'))
    expect(restore).not.toContain('offerAcceptance')
    expect(restore).not.toContain('receipt')
    expect(restore).not.toContain('marketing')
    expect(restore).toContain('refresh()')
  })
})

describe('document rendering and source boundaries', () => {
  it('escapes document text instead of executing it', () => {
    const html = renderToStaticMarkup(
      <LegalBlocks blocks={[{ type: 'paragraph', text: '<script>alert(1)</script>' }, { type: 'table', rows: [['<b>1</b>']] }]} />
    )
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>')
  })

  // This package is intentionally private and gitignored; a clean checkout has none.
  const packagePath = join(process.cwd(), '_private_legal_import', 'documents.json')
  it.skipIf(!existsSync(packagePath))('does not embed the private legal package', () => {
    const packaged = JSON.parse(readFileSync(packagePath, 'utf8')) as { documents: Array<{ sha256: string; body_markdown: string }> }
    const sources = walk(root).map((path) => readFileSync(path, 'utf8')).join('\n')
    for (const document of packaged.documents) {
      expect(sources).not.toContain(document.sha256)
      expect(sources).not.toContain(document.body_markdown.slice(0, 120))
    }
  })

  it('does not embed retired short policies', () => {
    const sources = walk(root).map((path) => readFileSync(path, 'utf8')).join('\n')
    expect(sources).not.toContain('Мы заботимся о вашей конфиденциальности и обрабатываем только те данные')
    expect(sources).not.toContain('Используя приложение, вы принимаете эти условия.')
  })
})
