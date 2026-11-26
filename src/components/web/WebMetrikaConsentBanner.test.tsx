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
    vi.unstubAllEnvs()
    localStorage.clear()
  })

  it('shows the full Metrika consent text before the visitor chooses', async () => {
    renderBanner()
    await screen.findByRole('dialog')
    expect(getMetrikaConsent()).toBe('unknown')
    expect(screen.getByText('Полный текст согласия')).toBeTruthy()
    const body = document.querySelector('.web-metrika-consent-text__body')
    expect(body).not.toBeNull()
    const text = body?.textContent ?? ''
    for (const paragraph of METRIKA_CONSENT_PARAGRAPHS) expect(text).toContain(paragraph)
    expect(text).toContain('ООО «ЯНДЕКС»')
    expect(text).toContain('Кулешов Даниил Алексеевич')
    expect(text).toContain('Не передаются')
    expect(text).toContain('не заменяет и не включает согласие на собственную аналитику')
    // The two choices are present and nothing was granted yet.
    expect(screen.getByRole('button', { name: 'Разрешить Метрику' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Отказаться' })).toBeTruthy()
  })

  it('links to the privacy policy, never to the first-party analytics document', async () => {
    renderBanner()
    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: 'политике конфиденциальности' }))
    expect(openDocument).toHaveBeenCalledWith('privacy')
    expect(openDocument).not.toHaveBeenCalledWith('analytics')
  })

  it('keeps Metrika consent separate from first-party analytics in both directions', async () => {
    renderBanner()
    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: 'Разрешить Метрику' }))
    await waitFor(() => expect(getMetrikaConsent()).toBe('granted'))
    // Granting Metrika must not open the first-party analytics gate or write its keys.
    expect(canSendAnalytics('app_open')).toBe(false)
    expect(Object.keys(localStorage).filter((key) => key !== 'gnh_metrika_consent_v2')).toEqual([])
  })

  it('refusal stores denied and does not touch the analytics gate', async () => {
    renderBanner()
    await screen.findByRole('dialog')
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
    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: 'Разрешить Метрику' }))
    await waitFor(() => expect(persistMetrikaConsentEvidence).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 50))
    expect(getMetrikaConsent()).toBe('unknown')
    expect(enableYandexMetrika).not.toHaveBeenCalled()
  })})
