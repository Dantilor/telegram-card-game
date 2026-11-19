import assert from 'node:assert/strict'
import test from 'node:test'
import { sanitizeWebDisplayName } from './webDisplayName.ts'
import { isGameplayPath, isDismissedRecently } from './webInstall.ts'

test('sanitizeWebDisplayName strips controls and limits length', () => {
  assert.equal(sanitizeWebDisplayName('  Анна\u0000  '), 'Анна')
  assert.equal(sanitizeWebDisplayName('a'.repeat(100)).length, 40)
})

test('isGameplayPath hides install UI in game flows only', () => {
  assert.equal(isGameplayPath('/profile'), false)
  assert.equal(isGameplayPath('/games'), false)
  assert.equal(isGameplayPath('/play/deck-1'), true)
  assert.equal(isGameplayPath('/alias/play'), true)
  assert.equal(isGameplayPath('/sled'), true)
  assert.equal(isGameplayPath('/premium'), false)
})

test('isDismissedRecently reads future timestamp', () => {
  const key = 'gnh_web_install_dismiss_until_v1'
  const now = Date.now()
  // @ts-expect-error test stub
  globalThis.localStorage = {
    store: { [key]: String(now + 60_000) },
    getItem(k) { return this.store[k] ?? null },
    setItem(k, v) { this.store[k] = String(v) },
    removeItem(k) { delete this.store[k] },
  }
  assert.equal(isDismissedRecently(now), true)
  assert.equal(isDismissedRecently(now + 120_000), false)
})
