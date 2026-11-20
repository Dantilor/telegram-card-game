import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { planAllowedForChannel, isLifetimePlan } from './plans.js'

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