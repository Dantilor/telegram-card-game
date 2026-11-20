import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { planAllowedForChannel, isLifetimePlan, getActivePlanById } from './plans.js'

const here = path.dirname(fileURLToPath(import.meta.url))

describe('planAllowedForChannel', () => {
  it('allows all-audience plans on both channels', () => {
    assert.equal(planAllowedForChannel({ audience: 'all' }, 'web'), true)
    assert.equal(planAllowedForChannel({ audience: 'all' }, 'telegram'), true)
  })

  it('isolates web and telegram audiences', () => {
    assert.equal(planAllowedForChannel({ audience: 'web' }, 'web'), true)
    assert.equal(planAllowedForChannel({ audience: 'web' }, 'telegram'), false)
    assert.equal(planAllowedForChannel({ audience: 'telegram' }, 'telegram'), true)
    assert.equal(planAllowedForChannel({ audience: 'telegram' }, 'web'), false)
  })
})

describe('isLifetimePlan', () => {
  it('recognizes telegram and web lifetime plan ids', () => {
    assert.equal(isLifetimePlan('premium_lifetime'), true)
    assert.equal(isLifetimePlan('premium_web_lifetime'), true)
    assert.equal(isLifetimePlan('premium_web_3m'), false)
  })
})

describe('pre-022 audience fallback', () => {
  it('getActivePlanById treats missing audience column as all (Telegram-compatible)', async () => {
    let calls = 0
    const db = {
      query: async <T>(_sql: string, _params?: unknown[]) => {
        calls += 1
        if (calls === 1) {
          throw new Error('column "audience" does not exist')
        }
        return {
          rows: [
            {
              plan_id: 'premium_1m',
              title: 'Premium на 1 месяц',
              price_rub: 259,
              duration_days: 30,
            },
          ] as T[],
        }
      },
    }
    const plan = await getActivePlanById('premium_1m', db)
    assert.equal(calls, 2)
    assert.equal(plan?.plan_id, 'premium_1m')
    assert.equal(plan?.price_rub, 259)
    assert.equal(plan?.audience, 'all')
    assert.equal(planAllowedForChannel(plan!, 'telegram'), true)
  })

  it('plansCatalog source keeps missing-audience fallback for Telegram lists', () => {
    const src = fs.readFileSync(path.join(here, 'plansCatalog.ts'), 'utf8')
    assert.match(src, /isMissingAudienceColumn/)
    assert.match(src, /Pre-022 schema/)
    assert.match(src, /filter === 'web'/)
    assert.match(src, /audience: 'all'/)
    assert.doesNotMatch(src, /COALESCE\(\s*plan_id\s*,\s*id\s*\)/)
  })

  it('getActivePlanById SQL uses plan_id only (production has no plans.id)', () => {
    const src = fs.readFileSync(path.join(here, 'plans.ts'), 'utf8')
    assert.match(src, /WHERE plan_id = \$1 AND is_active = true/)
    assert.doesNotMatch(src, /COALESCE\(\s*plan_id\s*,\s*id\s*\)/)
    assert.doesNotMatch(src, /OR\s+id\s*=/)
  })
})