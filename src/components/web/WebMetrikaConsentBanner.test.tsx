// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const openDocument = vi.fn()

vi.mock('../../legal/LegalProvider', () => ({
  useLegal: () => ({
    status: 'ready',
    records: { agreement: { active: true }, consents: [] },
    openDocument,
  }),
}))

vi.mock('../../analytics/yandexMetrika', () => ({
  enableYandexMetrika: vi.fn(async () => undefined),
  disableYandexMetrika: vi.fn(),
  hitYandexMetrika: vi.fn(),
  purgeMetrikaStorage: vi.fn(),
}))

vi.mock('../../analytics/persistMetrikaConsent', () => ({
  persistMetrikaConsentEvidence: vi.fn(async () => true),
}))

import { persistMetrikaConsentEvidence } from '../../analytics/persistMetrikaConsent'
import { enableYandexMetrika } from '../../analytics/yandexMetrika'
import WebMetrikaConsentBanner from './WebMetrikaConsentBanner'
import MetrikaConsentControls from './MetrikaConsentControls'
import { METRIKA_CONSENT_PARAGRAPHS } from './metrikaConsentText'
import { getMetrikaConsent } from '../../analytics/metrikaConsent'
import { canSendAnalytics, resetAnalyticsGate } from '../../legal/analyticsGate'

function renderBanner() {
  return render(
    <MemoryRouter>
      <WebMetrikaConsentBanner />
    </MemoryRouter>,
  )
}

describe('Metrika consent UI', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_GNH_SHELL', 'web')
    vi.stubEnv('VITE_GNH_METRIKA_ENABLED', '1')
    localStorage.clear()
    sessionStorage.clear()
    resetAnalyticsGate()
    openDocument.mockClear()
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllEnvs()
    localStorage.clear()
  })

  it('shows a compact collapsed banner with the short text and three choices', async () => {
    renderBanner()
    const region = await screen.findByRole('region')
    expect(getMetrikaConsent()).toBe('unknown')
    expect(region.textContent).toContain('Аналитика сайта')
    expect(region.textContent).toContain(
      'Мы используем Яндекс Метрику для анализа посещаемости сайта и эффективности рекламы. Метрика включается только с вашего согласия.',
    )
    // Not a modal, no backdrop, full text collapsed.
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.querySelector('.web-metrika-consent-text__body')).toBeNull()
    expect(screen.getByRole('button', { name: 'Разрешить Метрику' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Отказаться' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Позже' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Подробнее' }).getAttribute('aria-expanded')).toBe('false')
  })

  it('«Подробнее» reveals the complete unchanged consent text before any choice', async () => {
    renderBanner()
    await screen.findByRole('region')
    fireEvent.click(screen.getByRole('button', { name: 'Подробнее' }))
    const body = document.querySelector('.web-metrika-consent-text__body')
    expect(body).not.toBeNull()
    const text = body?.textContent ?? ''
    for (const paragraph of METRIKA_CONSENT_PARAGRAPHS) expect(text).toContain(paragraph)
    expect(text).toContain('ООО «ЯНДЕКС»')
    expect(text).toContain('Кулешов Даниил Алексеевич')
    expect(text).toContain('Не передаются')
    expect(text).toContain('не заменяет и не включает согласие на собственную аналитику')
    expect(screen.getByRole('button', { name: 'Свернуть' })).toBeTruthy()
    expect(getMetrikaConsent()).toBe('unknown')
  })

  it('«Позже» hides the banner for the session without storing consent or loading Metrika', async () => {
    vi.mocked(enableYandexMetrika).mockClear()
    vi.mocked(persistMetrikaConsentEvidence).mockClear()
    const first = renderBanner()
    await screen.findByRole('region')
    fireEvent.click(screen.getByRole('button', { name: 'Позже' }))
    await waitFor(() => expect(screen.queryByRole('region')).toBeNull())
    expect(getMetrikaConsent()).toBe('unknown')
    expect(localStorage.length).toBe(0)
    expect(persistMetrikaConsentEvidence).not.toHaveBeenCalled()
    expect(enableYandexMetrika).not.toHaveBeenCalled()
    // Same session, reopened page: still hidden.
    first.unmount()
    renderBanner()
    await new Promise((r) => setTimeout(r, 900))
    expect(screen.queryByRole('region')).toBeNull()
    // New session: shown again.
    cleanup()
    sessionStorage.clear()
    renderBanner()
    expect(await screen.findByRole('region')).toBeTruthy()
  })
  it('links to the privacy policy, never to the first-party analytics document', async () => {
    renderBanner()
    await screen.findByRole('region')
    fireEvent.click(screen.getByRole('button', { name: 'Подробнее' }))
    fireEvent.click(screen.getByRole('button', { name: 'политике конфиденциальности' }))
    expect(openDocument).toHaveBeenCalledWith('privacy')
    expect(openDocument).not.toHaveBeenCalledWith('analytics')
  })

  it('keeps Metrika consent separate from first-party analytics in both directions', async () => {
    renderBanner()
    await screen.findByRole('region')
    fireEvent.click(screen.getByRole('button', { name: 'Разрешить Метрику' }))
    await waitFor(() => expect(getMetrikaConsent()).toBe('granted'))
    // Granting Metrika must not open the first-party analytics gate or write its keys.
    expect(canSendAnalytics('app_open')).toBe(false)
    expect(Object.keys(localStorage).filter((key) => key !== 'gnh_metrika_consent_v2')).toEqual([])
  })

  it('refusal stores denied and does not touch the analytics gate', async () => {
    renderBanner()
    await screen.findByRole('region')
    fireEvent.click(screen.getByRole('button', { name: 'Отказаться' }))
    await waitFor(() => expect(getMetrikaConsent()).toBe('denied'))
    expect(canSendAnalytics('app_open')).toBe(false)
  })

  it('does not treat first-party analytics consent as Metrika consent', () => {
    localStorage.setItem('gnh_analytics_consent', 'granted')
    localStorage.setItem('gnh_metrika_consent', 'granted')
    expect(getMetrikaConsent()).toBe('unknown')
  })

  it('profile control shows the same full text', () => {
    render(<MetrikaConsentControls />)
    const text = document.querySelector('.web-metrika-consent-text__body')?.textContent ?? ''
    expect(text).toContain(METRIKA_CONSENT_PARAGRAPHS[3])
    expect(screen.getByRole('button', { name: 'Разрешить Метрику' })).toBeTruthy()
  })

  it('fails closed: if the server refuses the consent (privacy not active / API down) Metrika is not loaded', async () => {
    cleanup()
    vi.mocked(persistMetrikaConsentEvidence).mockResolvedValueOnce(false)
    vi.mocked(enableYandexMetrika).mockClear()
    renderBanner()
    await screen.findByRole('region')
    fireEvent.click(screen.getByRole('button', { name: 'Разрешить Метрику' }))
    await waitFor(() => expect(persistMetrikaConsentEvidence).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 50))
    expect(getMetrikaConsent()).toBe('unknown')
    expect(enableYandexMetrika).not.toHaveBeenCalled()
  })})
