import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getMailTransport,
  resetMailTransportCache,
  createSmtpMailTransport,
  diagnoseSmtpConfig,
  maskEmailForLog,
  setNodemailerFactoryForTests,
  sendOneShotMail,
} from './mailTransport.js'

const SMTP_KEYS = [
  'SMTP_ENABLED',
  'SMTP_FROM',
  'SMTP_RELAY_URL',
  'SMTP_RELAY_TOKEN',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_SECURE',
  'SMTP_USER',
  'SMTP_PASSWORD',
  'SMTP_TRANSPORT',
  'NODE_ENV',
  'GNH_PRODUCTION',
  'TIMEWEB',
] as const

function snapshotEnv(): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {}
  for (const k of SMTP_KEYS) out[k] = process.env[k]
  return out
}

function restoreEnv(prev: Record<string, string | undefined>): void {
  for (const k of SMTP_KEYS) {
    if (prev[k] == null) delete process.env[k]
    else process.env[k] = prev[k]
  }
  resetMailTransportCache()
  setNodemailerFactoryForTests(null)
}

function clearSmtpEnv(): void {
  for (const k of SMTP_KEYS) {
    if (k === 'NODE_ENV') continue
    delete process.env[k]
  }
}

test('maskEmailForLog redacts local part', () => {
  assert.equal(maskEmailForLog('owner@example.com'), 'o***@example.com')
})

test('production refuses silent test-mail fallback', () => {
  const prev = snapshotEnv()
  try {
    resetMailTransportCache()
    process.env.NODE_ENV = 'production'
    clearSmtpEnv()
    assert.throws(() => getMailTransport(), /SMTP must be configured/)
  } finally {
    restoreEnv(prev)
  }
})

test('createSmtpMailTransport throws without relay or direct SMTP in production-like mode', () => {
  const prev = snapshotEnv()
  try {
    process.env.NODE_ENV = 'production'
    clearSmtpEnv()
    process.env.SMTP_ENABLED = '1'
    process.env.SMTP_FROM = 'noreply@example.test'
    assert.throws(
      () => createSmtpMailTransport({ allowTestFallback: false }),
      /SMTP_RELAY_URL|SMTP_HOST/
    )
  } finally {
    restoreEnv(prev)
  }
})

test('diagnoseSmtpConfig reports direct SMTP ready without secrets', () => {
  const prev = snapshotEnv()
  try {
    clearSmtpEnv()
    process.env.SMTP_ENABLED = '1'
    process.env.SMTP_FROM = 'GameNight Host <noreply@gamenighthost.ru>'
    process.env.SMTP_HOST = 'smtp.timeweb.ru'
    process.env.SMTP_PORT = '465'
    process.env.SMTP_SECURE = 'true'
    process.env.SMTP_USER = 'noreply@gamenighthost.ru'
    process.env.SMTP_PASSWORD = 'super-secret-password'
    const d = diagnoseSmtpConfig()
    assert.equal(d.ok, true)
    assert.equal(d.mode, 'smtp')
    assert.equal(d.host, 'smtp.timeweb.ru')
    assert.equal(d.port, 465)
    assert.equal(d.secure, true)
    assert.equal(d.userConfigured, true)
    assert.equal(d.passwordConfigured, true)
    assert.equal(d.tlsRejectUnauthorized, true)
    assert.equal(d.relayConfigured, false)
    assert.ok(!JSON.stringify(d).includes('super-secret-password'))
  } finally {
    restoreEnv(prev)
  }
})

test('diagnoseSmtpConfig flags conflict when both relay and direct SMTP set', () => {
  const prev = snapshotEnv()
  try {
    clearSmtpEnv()
    process.env.SMTP_ENABLED = '1'
    process.env.SMTP_FROM = 'noreply@example.test'
    process.env.SMTP_RELAY_URL = 'https://relay.example/send'
    process.env.SMTP_HOST = 'smtp.timeweb.ru'
    process.env.SMTP_PORT = '465'
    process.env.SMTP_USER = 'noreply@example.test'
    process.env.SMTP_PASSWORD = 'x'
    const d = diagnoseSmtpConfig()
    assert.equal(d.mode, 'conflict')
    assert.equal(d.ok, false)
    assert.ok(d.issues.some((i) => /SMTP_TRANSPORT/.test(i)))
    assert.throws(
      () => createSmtpMailTransport({ allowTestFallback: false }),
      /SMTP conflict|SMTP_TRANSPORT/
    )
  } finally {
    restoreEnv(prev)
  }
})

test('SMTP_TRANSPORT=smtp resolves conflict in favor of direct SMTP', () => {
  const prev = snapshotEnv()
  try {
    clearSmtpEnv()
    process.env.SMTP_ENABLED = '1'
    process.env.SMTP_FROM = 'noreply@example.test'
    process.env.SMTP_RELAY_URL = 'https://relay.example/send'
    process.env.SMTP_HOST = 'smtp.timeweb.ru'
    process.env.SMTP_PORT = '465'
    process.env.SMTP_SECURE = 'true'
    process.env.SMTP_USER = 'noreply@example.test'
    process.env.SMTP_PASSWORD = 'x'
    process.env.SMTP_TRANSPORT = 'smtp'
    const d = diagnoseSmtpConfig()
    assert.equal(d.mode, 'smtp')
    assert.equal(d.ok, true)
  } finally {
    restoreEnv(prev)
  }
})

test('HTTP relay still works when only SMTP_RELAY_URL is set', async () => {
  const prev = snapshotEnv()
  const originalFetch = globalThis.fetch
  try {
    clearSmtpEnv()
    process.env.SMTP_ENABLED = '1'
    process.env.SMTP_FROM = 'GameNight Host <noreply@example.test>'
    process.env.SMTP_RELAY_URL = 'https://relay.example/v1/send'
    let body: unknown = null
    globalThis.fetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      body = JSON.parse(String(init?.body || '{}'))
      return new Response('{}', { status: 200 })
    }) as typeof fetch
    const t = createSmtpMailTransport({ allowTestFallback: false })
    const result = await t.send({
      to: 'buyer@example.com',
      subject: 'Test',
      text: 'hello',
      html: '<p>hello</p>',
    })
    assert.equal(result.transport, 'smtp_relay')
    assert.deepEqual(body, {
      from: 'GameNight Host <noreply@example.test>',
      to: 'buyer@example.com',
      subject: 'Test',
      text: 'hello',
      html: '<p>hello</p>',
    })
  } finally {
    globalThis.fetch = originalFetch
    restoreEnv(prev)
  }
})

test('relay failure is not reported as success', async () => {
  const prev = snapshotEnv()
  const originalFetch = globalThis.fetch
  try {
    clearSmtpEnv()
    process.env.SMTP_ENABLED = '1'
    process.env.SMTP_FROM = 'noreply@example.test'
    process.env.SMTP_RELAY_URL = 'https://relay.example/v1/send'
    globalThis.fetch = (async () => new Response('nope', { status: 503 })) as typeof fetch
    const t = createSmtpMailTransport({ allowTestFallback: false })
    await assert.rejects(
      () => t.send({ to: 'a@b.c', subject: 'x', text: 'y' }),
      (err: Error & { code?: string; status?: number }) => {
        assert.equal(err.code, 'mail_relay_failed')
        assert.equal(err.status, 502)
        return true
      }
    )
  } finally {
    globalThis.fetch = originalFetch
    restoreEnv(prev)
  }
})

test('direct SMTP uses nodemailer with TLS rejectUnauthorized and correct From', async () => {
  const prev = snapshotEnv()
  try {
    clearSmtpEnv()
    process.env.SMTP_ENABLED = '1'
    process.env.SMTP_FROM = 'GameNight Host <noreply@gamenighthost.ru>'
    process.env.SMTP_HOST = 'smtp.timeweb.ru'
    process.env.SMTP_PORT = '465'
    process.env.SMTP_SECURE = 'true'
    process.env.SMTP_USER = 'noreply@gamenighthost.ru'
    process.env.SMTP_PASSWORD = 'secret-value'
    let capturedOptions: Record<string, unknown> | null = null
    let capturedMail: Record<string, unknown> | null = null
    setNodemailerFactoryForTests((options) => {
      capturedOptions = options as Record<string, unknown>
      return {
        async sendMail(mail) {
          capturedMail = mail as Record<string, unknown>
          return { messageId: 'test-id' }
        },
      }
    })
    const t = createSmtpMailTransport({ allowTestFallback: false })
    const result = await t.send({
      to: 'player@example.com',
      subject: 'GameNight Host — подтвердите почту',
      text: 'link',
      html: '<a href="https://play.gamenighthost.ru/email/confirm?token=abc">ok</a>',
    })
    assert.equal(result.transport, 'smtp')
    assert.equal(capturedOptions?.host, 'smtp.timeweb.ru')
    assert.equal(capturedOptions?.port, 465)
    assert.equal(capturedOptions?.secure, true)
    const tls = capturedOptions?.tls as { rejectUnauthorized?: boolean }
    assert.equal(tls?.rejectUnauthorized, true)
    assert.equal(capturedMail?.from, 'GameNight Host <noreply@gamenighthost.ru>')
    assert.equal(capturedMail?.to, 'player@example.com')
  } finally {
    restoreEnv(prev)
  }
})

test('missing SMTP credentials fail diagnose and create', () => {
  const prev = snapshotEnv()
  try {
    clearSmtpEnv()
    process.env.SMTP_ENABLED = '1'
    process.env.SMTP_FROM = 'noreply@example.test'
    process.env.SMTP_HOST = 'smtp.timeweb.ru'
    process.env.SMTP_PORT = '465'
    process.env.SMTP_USER = 'noreply@example.test'
    // password missing
    const d = diagnoseSmtpConfig()
    assert.equal(d.ok, false)
    assert.equal(d.directSmtpConfigured, false)
    assert.throws(() => createSmtpMailTransport({ allowTestFallback: false }), /SMTP/)
  } finally {
    restoreEnv(prev)
  }
})

test('SMTP auth failure surfaces as mail_smtp_auth', async () => {
  const prev = snapshotEnv()
  try {
    clearSmtpEnv()
    process.env.SMTP_ENABLED = '1'
    process.env.SMTP_FROM = 'noreply@example.test'
    process.env.SMTP_HOST = 'smtp.timeweb.ru'
    process.env.SMTP_PORT = '465'
    process.env.SMTP_SECURE = 'true'
    process.env.SMTP_USER = 'noreply@example.test'
    process.env.SMTP_PASSWORD = 'bad'
    setNodemailerFactoryForTests(() => ({
      async sendMail() {
        const err = new Error('Invalid login') as Error & { code: string }
        err.code = 'EAUTH'
        throw err
      },
    }))
    const t = createSmtpMailTransport({ allowTestFallback: false })
    await assert.rejects(
      () => t.send({ to: 'a@b.c', subject: 'x', text: 'y' }),
      (err: Error & { code?: string; status?: number }) => {
        assert.equal(err.code, 'mail_smtp_auth')
        assert.equal(err.status, 502)
        assert.ok(!/bad|password|Invalid login/i.test(err.message) || err.message === 'SMTP authentication failed')
        return true
      }
    )
  } finally {
    restoreEnv(prev)
  }
})

test('getMailTransport uses direct SMTP in production when relay absent', () => {
  const prev = snapshotEnv()
  try {
    clearSmtpEnv()
    process.env.NODE_ENV = 'production'
    process.env.SMTP_ENABLED = '1'
    process.env.SMTP_FROM = 'noreply@example.test'
    process.env.SMTP_HOST = 'smtp.timeweb.ru'
    process.env.SMTP_PORT = '465'
    process.env.SMTP_SECURE = 'true'
    process.env.SMTP_USER = 'noreply@example.test'
    process.env.SMTP_PASSWORD = 'x'
    setNodemailerFactoryForTests(() => ({
      async sendMail() {
        return {}
      },
    }))
    resetMailTransportCache()
    const t = getMailTransport()
    assert.ok(t)
  } finally {
    restoreEnv(prev)
  }
})

test('sendOneShotMail refuses test fallback', async () => {
  const prev = snapshotEnv()
  try {
    clearSmtpEnv()
    process.env.SMTP_FROM = 'noreply@example.test'
    await assert.rejects(() =>
      sendOneShotMail({ to: 'a@b.c', subject: 'x', text: 'y' })
    )
  } finally {
    restoreEnv(prev)
  }
})
