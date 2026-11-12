import assert from 'node:assert/strict'
import test from 'node:test'
import { buildAllowedCorsOrigins, isOriginAllowed, originFromUrl } from './corsOrigins.js'

test('originFromUrl strips Mini App paths so CORS can match browser Origin', () => {
  assert.equal(originFromUrl('https://dantilor.github.io/telegram-card-game/'), 'https://dantilor.github.io')
  assert.equal(originFromUrl('https://example.twc1.net/app'), 'https://example.twc1.net')
  assert.equal(originFromUrl('not a url'), null)
})

test('buildAllowedCorsOrigins keeps localhost, github pages, and WEBAPP_URL origin', () => {
  const allowed = buildAllowedCorsOrigins({
    CORS_ORIGIN: 'https://dantilor.github.io/telegram-card-game/',
    WEBAPP_URL: 'https://gnh-static.example.twc1.net/',
  })
  assert.equal(isOriginAllowed('https://dantilor.github.io', allowed), true)
  assert.equal(isOriginAllowed('https://gnh-static.example.twc1.net', allowed), true)
  assert.equal(isOriginAllowed('http://localhost:5173', allowed), true)
  assert.equal(isOriginAllowed('https://evil.example', allowed), false)
})

test('missing Origin is allowed for same-origin and non-browser clients', () => {
  assert.equal(isOriginAllowed(undefined, ['https://dantilor.github.io']), true)
})
