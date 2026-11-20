import { describe, expect, it } from 'vitest'
import { buildWebPremiumPlans, buildWheelCatalog } from './webPremiumCatalog'
import { GAMES } from '../data/games'

describe('buildWebPremiumPlans', () => {
  it('maps WEB plans to kit reference labels, CTAs and badges', () => {
    const plans = buildWebPremiumPlans([
      { id: 'premium_web_1m', title: 'Premium 30d', priceRub: 259, durationDays: 30, audience: 'web' },
      { id: 'premium_web_3m', title: 'Premium 90d', priceRub: 499, durationDays: 90, audience: 'web' },
      { id: 'premium_web_lifetime', title: 'Premium life', priceRub: 1190, durationDays: 36500, audience: 'web' },
    ])
    expect(plans).toHaveLength(3)
    const month = plans.find((p) => p.id === 'premium_web_1m')
    const quarter = plans.find((p) => p.id === 'premium_web_3m')
    const life = plans.find((p) => p.id === 'premium_web_lifetime')
    expect(month?.description).toBe('\u0414\u043B\u044F \u043F\u0435\u0440\u0432\u043E\u0433\u043E \u0437\u043D\u0430\u043A\u043E\u043C\u0441\u0442\u0432\u0430')
    expect(month?.cta).toBe('\u0412\u044B\u0431\u0440\u0430\u0442\u044C 30 \u0434\u043D\u0435\u0439')
    expect(quarter?.recommended).toBe(true)
    expect(quarter?.badge).toBe('\u041B\u0443\u0447\u0448\u0438\u0439 \u0432\u044B\u0431\u043E\u0440')
    expect(quarter?.description).toBe('\u0414\u043B\u044F \u0442\u0435\u0445, \u043A\u0442\u043E \u0441\u043E\u0431\u0438\u0440\u0430\u0435\u0442\u0441\u044F \u0447\u0430\u0449\u0435')
    expect(quarter?.cta).toBe('\u0412\u044B\u0431\u0440\u0430\u0442\u044C 90 \u0434\u043D\u0435\u0439')
    expect(quarter?.price).toBe(499)
    expect(life?.badge).toBe('\u041C\u0430\u043A\u0441\u0438\u043C\u0430\u043B\u044C\u043D\u0430\u044F \u0432\u044B\u0433\u043E\u0434\u0430')
    expect(life?.description).toBe('\u0414\u043B\u044F \u0432\u0441\u0435\u0445 \u0432\u0430\u0448\u0438\u0445 \u0431\u0443\u0434\u0443\u0449\u0438\u0445 \u0432\u0435\u0447\u0435\u0440\u043E\u0432')
    expect(life?.cta).toBe('\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043D\u0430\u0432\u0441\u0435\u0433\u0434\u0430')
    expect(life?.price).toBe(1190)
    expect(plans[0]?.price).toBe(259)
  })

  it('ignores telegram plan ids', () => {
    const plans = buildWebPremiumPlans([
      { id: 'premium_3m', title: 'old', priceRub: 990, durationDays: 90, audience: 'telegram' },
    ])
    expect(plans).toHaveLength(0)
  })
})

describe('buildWheelCatalog', () => {
  it('builds catalog from real ready games', () => {
    const catalog = buildWheelCatalog()
    expect(catalog.length).toBeGreaterThan(0)
    expect(catalog.every((g) => GAMES.some((x) => x.id === g.id))).toBe(true)
    expect(catalog.every((g) => g.players[0] <= g.players[1])).toBe(true)
  })
})