import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getMailTransport,
  resetMailTransportCache,
  createSmtpMailTransport,
} from './mailTransport.js'

test('production refuses silent test-mail fallback', () => {
  const prev = { ...process.env }
  try {
    resetMailTransportCache()
    process.env.NODE_ENV = 'production'
    delete process.env.SMTP_ENABLED
    delete process.env.SMTP_FROM
    delete process.env.SMTP_RELAY_URL
    assert.throws(() => getMailTransport(), /SMTP must be configured/)
  } finally {
    resetMailTransportCache()
    process.env.NODE_ENV = prev.NODE_ENV
    for (const k of ['SMTP_ENABLED', 'SMTP_FROM', 'SMTP_RELAY_URL'] as const) {
      if (prev[k] == null) delete process.env[k]
      else process.env[k] = prev[k]
    }
  }
})

test('createSmtpMailTransport throws without relay in production-like mode', () => {
  const prev = { ...process.env }
  try {
    process.env.NODE_ENV = 'production'
    process.env.SMTP_FROM = 'noreply@example.test'
    delete process.env.SMTP_RELAY_URL
    assert.throws(() => createSmtpMailTransport({ allowTestFallback: false }), /SMTP_RELAY_URL/)
  } finally {
    process.env.NODE_ENV = prev.NODE_ENV
    if (prev.SMTP_FROM == null) delete process.env.SMTP_FROM
    else process.env.SMTP_FROM = prev.SMTP_FROM
    if (prev.SMTP_RELAY_URL == null) delete process.env.SMTP_RELAY_URL
    else process.env.SMTP_RELAY_URL = prev.SMTP_RELAY_URL
  }
})
