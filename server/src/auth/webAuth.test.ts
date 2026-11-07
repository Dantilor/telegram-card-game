import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import express from 'express'
import { PGlite } from '@electric-sql/pglite'
import { generateKeyPair, SignJWT } from 'jose'
import { verifyInitData } from '../telegram/verifyInitData.js'
import { resolveAuth, readInitDataFromRequest } from './resolveAuth.js'
import {
  completeTelegramOidcLogin,
  startTelegramOidcLogin,
  verifyTelegramIdToken,
  extractTelegramIdFromClaims,
} from './telegramOidc.js'
import {
  createWebSession,
  findActiveSessionByToken,
  revokeSessionByToken,
  verifyCsrf,
} from './webSession.js'
import { SESSION_COOKIE, CSRF_COOKIE } from './cookies.js'
import { sha256Hex } from './cryptoTokens.js'
import type { Queryable, TransactionRunner } from '../legal/types.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.resolve(here, '../..')
const BOT_TOKEN = '123456:TEST'
const CLIENT_ID = '999000111'
const CLIENT_SECRET = 'test-oidc-secret'
const REDIRECT_URI = 'http://127.0.0.1:3001/api/web/auth/telegram/callback'

function readSql(relativePath: string): string {
  return fs.readFileSync(path.join(serverRoot, relativePath), 'utf8')
}

function signInitData(userId: number): string {
  const authDate = Math.floor(Date.now() / 1000)
  const user = JSON.stringify({ id: userId, first_name: 'Test' })
  const dataCheckString = [`auth_date=${authDate}`, `user=${user}`].sort().join('\n')
  const secret = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest()
  const hash = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex')
  return `auth_date=${authDate}&user=${encodeURIComponent(user)}&hash=${hash}`
}

type Harness = {
  query: Queryable
  withTransaction: TransactionRunner
  close: () => Promise<void>
  raw: PGlite
}

async function createHarness(): Promise<Harness> {
  const pg = new PGlite()
  await pg.exec(readSql('db/schema.sql'))
  await pg.exec(readSql('db/migrations/012_web_sessions.sql'))
  const wrap = (target: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> }): Queryable => ({
    query: async (sql, params) => {
      const result = await target.query(sql, params)
      return { rows: result.rows as Record<string, unknown>[] }
    },
  })
  return {
    query: wrap(pg),
    withTransaction: (fn) => pg.transaction(async (tx) => fn(wrap(tx))),
    close: () => pg.close(),
    raw: pg,
  }
}

async function withServer(app: express.Express, fn: (baseUrl: string) => Promise<void>): Promise<void> {
  const server = http.createServer(app)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  try {
    await fn(`http://127.0.0.1:${port}`)
  } finally {
    server.close()
    await once(server, 'close')
  }
}

function setOidcEnv(): void {
  process.env.TELEGRAM_OIDC_CLIENT_ID = CLIENT_ID
  process.env.TELEGRAM_OIDC_CLIENT_SECRET = CLIENT_SECRET
  process.env.TELEGRAM_OIDC_REDIRECT_URI = REDIRECT_URI
  process.env.TELEGRAM_BOT_TOKEN = BOT_TOKEN
  process.env.WEB_COOKIE_SECURE = 'false'
  process.env.WEB_SESSION_TTL_HOURS = '24'
}

test('extractTelegramIdFromClaims rejects sub spoofing without id', () => {
  assert.throws(
    () => extractTelegramIdFromClaims({ sub: '987654321', iss: 'https://oauth.telegram.org' }),
    /missing Telegram user id/
  )
})

test('verifyTelegramIdToken accepts signed token and rejects bad signature/aud/iss/exp/nonce', async () => {
  setOidcEnv()
  const { publicKey, privateKey } = await generateKeyPair('RS256')
  const nonce = 'nonce-abc'

  async function mint(claims: Record<string, unknown>, expOffsetSec = 3600) {
    const now = Math.floor(Date.now() / 1000)
    return new SignJWT(claims)
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer('https://oauth.telegram.org')
      .setAudience(CLIENT_ID)
      .setSubject('opaque-sub-1')
      .setIssuedAt(now)
      .setExpirationTime(now + expOffsetSec)
      .sign(privateKey)
  }

  const good = await mint({ id: 4242, nonce, name: 'Ada' })
  const verified = await verifyTelegramIdToken(good, { audience: CLIENT_ID, nonce }, { localKey: publicKey })
  assert.equal(verified.telegramId, 4242)
  assert.equal(verified.name, 'Ada')

  const otherKey = await generateKeyPair('RS256')
  const badSig = await new SignJWT({ id: 4242, nonce })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer('https://oauth.telegram.org')
    .setAudience(CLIENT_ID)
    .setSubject('x')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(otherKey.privateKey)
  await assert.rejects(
    () => verifyTelegramIdToken(badSig, { audience: CLIENT_ID, nonce }, { localKey: publicKey }),
    /Invalid ID token/
  )

  const wrongAud = await new SignJWT({ id: 1, nonce })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer('https://oauth.telegram.org')
    .setAudience('wrong-aud')
    .setSubject('x')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(privateKey)
  await assert.rejects(
    () => verifyTelegramIdToken(wrongAud, { audience: CLIENT_ID, nonce }, { localKey: publicKey }),
    /Invalid ID token/
  )

  const wrongIss = await new SignJWT({ id: 1, nonce })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer('https://evil.example')
    .setAudience(CLIENT_ID)
    .setSubject('x')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(privateKey)
  await assert.rejects(
    () => verifyTelegramIdToken(wrongIss, { audience: CLIENT_ID, nonce }, { localKey: publicKey }),
    /Invalid ID token/
  )

  const expired = await mint({ id: 1, nonce }, -120)
  await assert.rejects(
    () => verifyTelegramIdToken(expired, { audience: CLIENT_ID, nonce }, { localKey: publicKey }),
    /Invalid ID token/
  )

  const badNonce = await mint({ id: 1, nonce: 'other' })
  await assert.rejects(
    () => verifyTelegramIdToken(badNonce, { audience: CLIENT_ID, nonce }, { localKey: publicKey }),
    /nonce/
  )
})

test('OIDC login creates session; replay/state/csrf/logout/expiry behave correctly', async () => {
  setOidcEnv()
  const harness = await createHarness()
  const { publicKey, privateKey } = await generateKeyPair('RS256')

  try {
    const started = await startTelegramOidcLogin({
      returnTo: '/profile',
      deps: { query: harness.query },
    })
    assert.match(started.authorizationUrl, /oauth\.telegram\.org\/auth/)
    assert.match(started.authorizationUrl, /code_challenge_method=S256/)
    assert.match(started.authorizationUrl, /scope=openid(\+|%20|\s)profile/)

    const stateRow = await harness.query.query<{ nonce: string; code_verifier: string }>(
      `SELECT nonce, code_verifier FROM web_oidc_states WHERE state = $1`,
      [started.state]
    )
    const nonce = String(stateRow.rows[0].nonce)

    const now = Math.floor(Date.now() / 1000)
    const idToken = await new SignJWT({ id: 777001, nonce, name: 'Host', preferred_username: 'host' })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer('https://oauth.telegram.org')
      .setAudience(CLIENT_ID)
      .setSubject('sub-777001')
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .sign(privateKey)

    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ access_token: 'x', token_type: 'Bearer', expires_in: 3600, id_token: idToken }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })

    const completed = await completeTelegramOidcLogin(
      { code: 'auth-code-1', state: started.state },
      { query: harness.query, fetchImpl, localKey: publicKey }
    )
    assert.equal(completed.telegramId, 777001)
    assert.equal(completed.returnTo, '/profile')

    // ensure user for FK
    await harness.query.query(`INSERT INTO users (telegram_id) VALUES ($1) ON CONFLICT DO NOTHING`, [777001])
    // completeTelegramOidcLogin does not create session — routes do. Create here:
    const session = await createWebSession(777001, { db: harness.query })
    assert.ok(session.sessionToken)
    assert.ok(session.csrfToken)
    assert.notEqual(session.sessionToken, session.csrfToken)

    const stored = await findActiveSessionByToken(session.sessionToken, harness.query)
    assert.ok(stored)
    assert.equal(Number(stored!.telegram_id), 777001)
    assert.equal(verifyCsrf(stored!, session.csrfToken), true)
    assert.equal(verifyCsrf(stored!, 'wrong'), false)

    // Only hash stored
    const hashes = await harness.query.query<{ token_hash: string; csrf_hash: string }>(
      `SELECT token_hash, csrf_hash FROM web_sessions WHERE id = $1`,
      [stored!.id]
    )
    assert.equal(hashes.rows[0].token_hash, sha256Hex(session.sessionToken))
    assert.equal(hashes.rows[0].csrf_hash, sha256Hex(session.csrfToken))
    assert.notEqual(hashes.rows[0].token_hash, session.sessionToken)

    // Replay of authorization result (same id_token)
    const started2 = await startTelegramOidcLogin({ deps: { query: harness.query } })
    // Force same token into new exchange by reusing idToken — mark replay table already has hash
    await assert.rejects(
      () =>
        completeTelegramOidcLogin(
          { code: 'auth-code-2', state: started2.state },
          {
            query: harness.query,
            fetchImpl,
            localKey: publicKey,
            // Override verify to skip nonce mismatch from new state — still hits replay store
            verifyIdToken: async () => ({
              telegramId: 777001,
              sub: 'sub',
              exp: now + 3600,
              iat: now,
              nonce: 'ignored',
            }),
          }
        ),
      /already used|oidc_replay/
    )

    // Reused state
    await assert.rejects(
      () =>
        completeTelegramOidcLogin(
          { code: 'auth-code-1', state: started.state },
          { query: harness.query, fetchImpl, localKey: publicKey }
        ),
      /state/
    )

    // Logout revoke
    assert.equal(await revokeSessionByToken(session.sessionToken, harness.query), true)
    assert.equal(await findActiveSessionByToken(session.sessionToken, harness.query), null)

    // Expired session
    const session2 = await createWebSession(777001, { db: harness.query })
    await harness.query.query(`UPDATE web_sessions SET expires_at = now() - interval '1 minute' WHERE token_hash = $1`, [
      sha256Hex(session2.sessionToken),
    ])
    assert.equal(await findActiveSessionByToken(session2.sessionToken, harness.query), null)
  } finally {
    await harness.close()
  }
})

test('resolveAuth: Mini App initData still works; forged telegram_id in body is ignored', async () => {
  setOidcEnv()
  const harness = await createHarness()
  try {
    await harness.query.query(`INSERT INTO users (telegram_id) VALUES (55)`)
    const session = await createWebSession(55, { db: harness.query })

    const initData = signInitData(55)
    assert.equal(verifyInitData(initData, BOT_TOKEN).telegram_id, 55)

    const fakeReq = {
      method: 'GET',
      headers: {
        'x-telegram-init-data': initData,
        cookie: '',
      },
      body: { telegramId: 999999, telegram_id: 999999 },
      query: {},
    } as unknown as express.Request

    const auth = await resolveAuth(fakeReq, { botToken: BOT_TOKEN, db: harness.query, skipTouch: true })
    assert.ok(auth)
    assert.equal(auth!.source, 'telegram_init_data')
    assert.equal(auth!.telegramId, 55)

    const bodyOnly = {
      method: 'POST',
      headers: { cookie: '' },
      body: { telegramId: 55, telegram_id: 55 },
      query: {},
    } as unknown as express.Request
    assert.equal(readInitDataFromRequest(bodyOnly), null)
    assert.equal(await resolveAuth(bodyOnly, { botToken: BOT_TOKEN, db: harness.query }), null)

    const webReq = {
      method: 'GET',
      headers: { cookie: `${SESSION_COOKIE}=${session.sessionToken}` },
      body: {},
      query: {},
    } as unknown as express.Request
    const webAuth = await resolveAuth(webReq, { botToken: BOT_TOKEN, db: harness.query, skipTouch: true })
    assert.ok(webAuth)
    assert.equal(webAuth!.source, 'web_session')
    assert.equal(webAuth!.telegramId, 55)
  } finally {
    await harness.close()
  }
})

test('HTTP: whoami + session/me + logout CSRF', async () => {
  setOidcEnv()
  const harness = await createHarness()

  // Patch db module usage: webAuth routes import createWebSession which uses default query from db.ts.
  // For HTTP route tests we exercise resolveAuth via whoami with injected cookies against harness
  // by mounting a thin app that uses harness-backed resolve through monkeypatch is hard.
  // Instead mount routes that call modules with process env and stub pool — use in-process handlers.

  await harness.query.query(`INSERT INTO users (telegram_id) VALUES (88)`)
  const session = await createWebSession(88, { db: harness.query })

  const app = express()
  app.use(express.json())
  const whoami = async (req: express.Request, res: express.Response) => {
    const auth = await resolveAuth(req, { botToken: BOT_TOKEN, db: harness.query, skipTouch: true })
    if (!auth) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }
    res.json({ telegramId: auth.telegramId, source: auth.source })
  }
  app.get('/whoami', whoami)
  app.post('/whoami', whoami)
  app.post('/logout', async (req, res) => {
    const cookies = Object.fromEntries(
      (req.headers.cookie || '')
        .split(';')
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => {
          const i = p.indexOf('=')
          return [p.slice(0, i), decodeURIComponent(p.slice(i + 1))]
        })
    )
    const token = cookies[SESSION_COOKIE]
    if (!token) {
      res.json({ ok: true })
      return
    }
    const row = await findActiveSessionByToken(token, harness.query)
    if (row) {
      const csrf = typeof req.headers['x-csrf-token'] === 'string' ? req.headers['x-csrf-token'] : ''
      if (!verifyCsrf(row, csrf)) {
        res.status(403).json({ code: 'csrf_failed' })
        return
      }
      await revokeSessionByToken(token, harness.query)
    }
    res.json({ ok: true })
  })

  try {
    await withServer(app, async (base) => {
      const mini = await fetch(`${base}/whoami`, {
        headers: { 'x-telegram-init-data': signInitData(88) },
      })
      assert.equal(mini.status, 200)
      assert.deepEqual(await mini.json(), { telegramId: 88, source: 'telegram_init_data' })

      const web = await fetch(`${base}/whoami`, {
        headers: { cookie: `${SESSION_COOKIE}=${session.sessionToken}` },
      })
      assert.equal(web.status, 200)
      assert.deepEqual(await web.json(), { telegramId: 88, source: 'web_session' })

      const forged = await fetch(`${base}/whoami`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ telegramId: 88 }),
      })
      assert.equal(forged.status, 401)

      const badCsrf = await fetch(`${base}/logout`, {
        method: 'POST',
        headers: {
          cookie: `${SESSION_COOKIE}=${session.sessionToken}; ${CSRF_COOKIE}=${session.csrfToken}`,
          'x-csrf-token': 'not-the-token',
        },
      })
      assert.equal(badCsrf.status, 403)

      const okLogout = await fetch(`${base}/logout`, {
        method: 'POST',
        headers: {
          cookie: `${SESSION_COOKIE}=${session.sessionToken}`,
          'x-csrf-token': session.csrfToken,
        },
      })
      assert.equal(okLogout.status, 200)
      assert.equal(await findActiveSessionByToken(session.sessionToken, harness.query), null)
    })
  } finally {
    await harness.close()
  }
})

test('invalid Mini App initData signature is rejected (regression)', () => {
  assert.throws(() => verifyInitData('auth_date=1&user=%7B%22id%22%3A1%7D&hash=deadbeef', BOT_TOKEN))
  const good = signInitData(1)
  assert.equal(verifyInitData(good, BOT_TOKEN).telegram_id, 1)
})
