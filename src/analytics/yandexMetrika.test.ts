import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setMetrikaConsent, clearMetrikaConsent } from './metrikaConsent'
import {
  disableYandexMetrika,
  enableYandexMetrika,
  hitYandexMetrika,
  isMetrikaInitialized,
  loadYandexMetrika,
  reachYandexGoal,
  resetYandexMetrikaForTests,
} from './yandexMetrika'
import { METRIKA_COUNTER_ID, METRIKA_SCRIPT_URL } from './metrikaConfig'
import {
  markMetrikaPaymentPending,
  PREMIUM_PURCHASE_METRIKA_ENABLED,
  reportMetrikaPremiumPurchaseConfirmed,
  resetMetrikaGoalsForTests,
  mirrorTrackEventToMetrika,
  reachMetrikaGoalOnce,
} from './metrikaGoals'

describe('yandexMetrika consent gate', () => {
  beforeEach(() => {
    resetYandexMetrikaForTests()
    resetMetrikaGoalsForTests()
    clearMetrikaConsent()
    document.head.innerHTML = ''
    document.body.innerHTML = ''
  })

  afterEach(() => {
    resetYandexMetrikaForTests()
    resetMetrikaGoalsForTests()
    clearMetrikaConsent()
  })

  it('does not inject tag.js without consent', async () => {
    await loadYandexMetrika()
    expect(document.querySelector('script[data-gnh-metrika="1"]')).toBeNull()
    expect(isMetrikaInitialized()).toBe(false)
  })

  it('loads official tag.js once after grant and inits without webvisor/clickmap/trackLinks', async () => {
    setMetrikaConsent('granted')
    const calls: unknown[][] = []
    window.ym = ((...args: unknown[]) => {
      calls.push(args)
    }) as typeof window.ym

    const script = document.createElement('script')
    script.dataset.gnhMetrika = '1'
    document.head.appendChild(script)

    await enableYandexMetrika()
    expect(isMetrikaInitialized()).toBe(true)
    expect(calls[0]?.[0]).toBe(METRIKA_COUNTER_ID)
    expect(calls[0]?.[1]).toBe('init')
    const init = calls[0]?.[2] as Record<string, unknown>
    expect(init.defer).toBe(true)
    expect(init.webvisor).toBe(false)
    expect(init.clickmap).toBe(false)
    expect(init.trackLinks).toBe(false)

    await enableYandexMetrika()
    expect(calls.filter((c) => c[1] === 'init')).toHaveLength(1)
  })

  it('sends a single SPA hit per path and scrubbed reachGoal params', async () => {
    setMetrikaConsent('granted')
    const calls: unknown[][] = []
    window.ym = ((...args: unknown[]) => {
      calls.push(args)
    }) as typeof window.ym
    const script = document.createElement('script')
    script.dataset.gnhMetrika = '1'
    document.head.appendChild(script)
    await enableYandexMetrika()

    hitYandexMetrika('/games')
    hitYandexMetrika('/games')
    hitYandexMetrika('/quiz')
    const hits = calls.filter((c) => c[1] === 'hit')
    expect(hits).toHaveLength(2)
    expect(String(hits[0]?.[2])).toContain('/games')
    expect(String(hits[0]?.[2])).not.toContain('token=')

    reachYandexGoal('game_start', { gameId: 'quiz', email: 'x@y.z' } as never)
    const goals = calls.filter((c) => c[1] === 'reachGoal')
    expect(goals[0]?.[2]).toBe('game_start')
    expect(goals[0]?.[3]).toEqual({ gameId: 'quiz' })
  })

  it('on revoke calls destruct, sets opt-out, removes script, and blocks further hits', async () => {
    setMetrikaConsent('granted')
    const calls: unknown[][] = []
    window.ym = ((...args: unknown[]) => {
      calls.push(args)
    }) as typeof window.ym
    const script = document.createElement('script')
    script.dataset.gnhMetrika = '1'
    script.src = METRIKA_SCRIPT_URL
    document.head.appendChild(script)
    await enableYandexMetrika()

    setMetrikaConsent('denied')
    disableYandexMetrika()
    expect(document.querySelector('script[data-gnh-metrika="1"]')).toBeNull()
    expect(isMetrikaInitialized()).toBe(false)
    expect(calls.some((c) => c[1] === 'destruct')).toBe(true)
    expect((window as unknown as Record<string, unknown>)[`disableYaCounter${METRIKA_COUNTER_ID}`]).toBe(true)

    hitYandexMetrika('/games')
    expect(calls.filter((c) => c[1] === 'hit')).toHaveLength(0)
  })

  it('does not emit premium_purchase while the goal is disabled', async () => {
    expect(PREMIUM_PURCHASE_METRIKA_ENABLED).toBe(false)
    setMetrikaConsent('granted')
    const calls: unknown[][] = []
    window.ym = ((...args: unknown[]) => {
      calls.push(args)
    }) as typeof window.ym
    const script = document.createElement('script')
    script.dataset.gnhMetrika = '1'
    document.head.appendChild(script)
    await enableYandexMetrika()

    markMetrikaPaymentPending()
    await reportMetrikaPremiumPurchaseConfirmed()
    await reportMetrikaPremiumPurchaseConfirmed()
    expect(calls.some((c) => c[1] === 'reachGoal' && c[2] === 'premium_purchase')).toBe(false)
  })

  it('mirrors start_game and yookassa_redirect without leaking props', async () => {
    setMetrikaConsent('granted')
    const calls: unknown[][] = []
    window.ym = ((...args: unknown[]) => {
      calls.push(args)
    }) as typeof window.ym
    const script = document.createElement('script')
    script.dataset.gnhMetrika = '1'
    document.head.appendChild(script)
    await enableYandexMetrika()

    mirrorTrackEventToMetrika('start_game', { gameId: 'mafia', token: 'nope' })
    await vi.waitFor(() => {
      expect(calls.some((c) => c[1] === 'reachGoal' && c[2] === 'game_start')).toBe(true)
    })
    const start = calls.find((c) => c[1] === 'reachGoal' && c[2] === 'game_start')
    expect(start?.[3]).toEqual({ gameId: 'mafia' })

    mirrorTrackEventToMetrika('yookassa_redirect', { planId: 'web_3m' })
    await vi.waitFor(() => {
      expect(calls.some((c) => c[1] === 'reachGoal' && c[2] === 'premium_payment_start')).toBe(true)
    })
  })
  it('never starts the tag on a URL with query or hash, then starts on the next clean URL', async () => {
    setMetrikaConsent('granted')
    const calls: unknown[][] = []
    window.ym = ((...args: unknown[]) => {
      calls.push(args)
    }) as typeof window.ym

    window.history.pushState({}, '', '/doubles?code=ROOM&token=SECRET')
    await enableYandexMetrika()
    expect(isMetrikaInitialized()).toBe(false)
    expect(document.querySelector('script[data-gnh-metrika="1"]')).toBeNull()
    expect(reachYandexGoal('game_open')).toBe(false)
    expect(calls).toHaveLength(0)

    window.history.pushState({}, '', '/doubles#room=X')
    await enableYandexMetrika()
    expect(isMetrikaInitialized()).toBe(false)
    expect(document.querySelector('script[data-gnh-metrika="1"]')).toBeNull()

    // jsdom never runs a real tag.js; a pre-existing tag element stands in for a loaded one.
    const tag = document.createElement('script')
    tag.dataset.gnhMetrika = '1'
    document.head.appendChild(tag)
    window.history.pushState({}, '', '/games')
    await enableYandexMetrika()
    expect(isMetrikaInitialized()).toBe(true)
  })

  it('sends a scrubbed hit before the first goal so goals never fall back to the real URL', async () => {
    setMetrikaConsent('granted')
    const calls: unknown[][] = []
    window.ym = ((...args: unknown[]) => {
      calls.push(args)
    }) as typeof window.ym
    const tag = document.createElement('script')
    tag.dataset.gnhMetrika = '1'
    document.head.appendChild(tag)
    window.history.pushState({}, '', '/quiz')
    await enableYandexMetrika()
    expect(calls.filter((c) => c[1] === 'hit')).toHaveLength(0)

    expect(reachYandexGoal('game_start', { gameId: 'quiz' })).toBe(true)
    const order = calls.map((c) => c[1])
    expect(order.indexOf('hit')).toBeGreaterThan(-1)
    expect(order.indexOf('hit')).toBeLessThan(order.indexOf('reachGoal'))
    const hit = calls.find((c) => c[1] === 'hit')
    expect(String(hit?.[2])).toMatch(/\/quiz$/)
  })

  it('does not touch window.ym or reload when the tag never ran (refusal from the banner)', () => {
    const own = (() => undefined) as unknown as typeof window.ym
    window.ym = own
    const timer = vi.spyOn(window, 'setTimeout')
    disableYandexMetrika({ reload: true })
    expect(window.ym).toBe(own)
    expect(timer).not.toHaveBeenCalled()
    timer.mockRestore()
  })

  it('revoke removes Metrika cookies and storage keys but leaves unrelated ones', async () => {
    setMetrikaConsent('granted')
    window.ym = (() => undefined) as unknown as typeof window.ym
    const script = document.createElement('script')
    script.dataset.gnhMetrika = '1'
    document.head.appendChild(script)
    await enableYandexMetrika()

    document.cookie = '_ym_uid=123; Path=/'
    document.cookie = '_ym_d=456; Path=/'
    document.cookie = 'keep_me=1; Path=/'
    localStorage.setItem('_ym_uid', '"1"')
    localStorage.setItem('_ym114652319_lsid', '1')
    localStorage.setItem('keep_ls', '1')

    disableYandexMetrika()
    expect(document.cookie).not.toContain('_ym_')
    expect(document.cookie).toContain('keep_me=1')
    expect(localStorage.getItem('_ym_uid')).toBeNull()
    expect(localStorage.getItem('_ym114652319_lsid')).toBeNull()
    expect(localStorage.getItem('keep_ls')).toBe('1')
    document.cookie = 'keep_me=; Max-Age=0; Path=/'
    localStorage.removeItem('keep_ls')
  })

  it('does not mark a goal as sent when it was skipped on a private URL', async () => {
    setMetrikaConsent('granted')
    const calls: unknown[][] = []
    window.ym = ((...args: unknown[]) => {
      calls.push(args)
    }) as typeof window.ym

    window.history.pushState({}, '', '/mafia-shadows?code=A&token=B')
    await reachMetrikaGoalOnce('game_open', '/mafia-shadows', { gameId: 'mafia-shadows' })
    expect(calls).toHaveLength(0)

    const tag = document.createElement('script')
    tag.dataset.gnhMetrika = '1'
    document.head.appendChild(tag)
    window.history.pushState({}, '', '/mafia-shadows')
    await reachMetrikaGoalOnce('game_open', '/mafia-shadows', { gameId: 'mafia-shadows' })
    expect(calls.filter((c) => c[1] === 'reachGoal' && c[2] === 'game_open')).toHaveLength(1)
    await reachMetrikaGoalOnce('game_open', '/mafia-shadows', { gameId: 'mafia-shadows' })
    expect(calls.filter((c) => c[1] === 'reachGoal' && c[2] === 'game_open')).toHaveLength(1)
  })
})