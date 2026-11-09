import 'dotenv/config'
import path from 'node:path'
import fs from 'node:fs'
import express from 'express'
import cors from 'cors'
import authRouter from './routes/auth.js'
import premiumRouter from './routes/premium.js'
import meRouter from './routes/me.js'
import plansRouter from './routes/plans.js'
import yookassaRouter from './routes/yookassa.js'
import apiRouter from './api.js'
import eventsRouter from './routes/events.js'
import publicStatsRouter from './routes/publicStats.js'
import adminRouter from './routes/admin.js'
import sledRoomsRouter from './routes/sledRooms.js'
import mafiaShadowsRouter from './routes/mafiaShadows.js'
import doublesRouter from './routes/doubles.js'
import infectedRouter from './routes/infected.js'
import webAuthRouter from './routes/webAuth.js'
import { createLegalHtmlRouter, createLegalRouter } from './routes/legal.js'
import { db, withTransaction } from './legal/runtime.js'
import { verifyInitData } from './telegram/verifyInitData.js'
import { getActivePlanById } from './services/plans.js'
import { bot } from './bot.js'
import { webPublicOrigin } from './auth/config.js'
import {
  assertStagingDatabaseUrl,
  isStagingRuntime,
  serveWebStaticEnabled,
  telegramBotSideEffectsDisabled,
  trustProxyHops,
  webFeatureEnabled,
} from './config/runtimeFlags.js'

const port = Number(process.env.PORT || 3001)
const corsOriginRaw = process.env.CORS_ORIGIN || 'http://localhost:5173'
const corsOrigins = corsOriginRaw
  .split(',')
  .map((o) => o.trim())
  .filter((o) => o && o !== '*')
const localhostOrigins = ['http://localhost:4173', 'http://localhost:5173', 'http://127.0.0.1:4173', 'http://127.0.0.1:5173']
const webOrigin = webPublicOrigin()
const allowedOrigins = [...new Set([...corsOrigins, ...localhostOrigins, ...(webOrigin ? [webOrigin] : [])])]

const BOT_WEBHOOK_PATH = (process.env.BOT_WEBHOOK_PATH || '/telegram/webhook-9f3k2lQp').replace(/\/+$/, '')

console.log('[TCG] ENV PORT =', process.env.PORT)
console.log(
  '[TCG] staging =',
  isStagingRuntime(),
  'webFeature =',
  webFeatureEnabled(),
  'serveWebStatic =',
  serveWebStaticEnabled(),
  'telegramBotSideEffectsDisabled =',
  telegramBotSideEffectsDisabled()
)

if (process.env.DATABASE_URL) {
  try {
    const u = new URL(process.env.DATABASE_URL)
    console.log('[DB] user=', u.username, 'host=', u.host, 'port=', u.port, 'db=', u.pathname)
  } catch {
    console.error('[DB] DATABASE_URL is not a valid URL (value not logged)')
    if (isStagingRuntime()) process.exit(1)
  }
  if (isStagingRuntime()) {
    const check = assertStagingDatabaseUrl(process.env.DATABASE_URL)
    if (!check.ok) {
      console.error('[DB] Staging database check failed:', check.reason)
      process.exit(1)
    }
  }
} else if (isStagingRuntime()) {
  console.error('[DB] DATABASE_URL is required in staging')
  process.exit(1)
}

if (isStagingRuntime()) {
  if (process.env.WEB_DEV_LOGIN_ENABLED === '1' || process.env.WEB_DEV_LOGIN_ENABLED === 'true') {
    console.error('[TCG] Refusing staging boot with WEB_DEV_LOGIN_ENABLED')
    process.exit(1)
  }
  console.log('[TCG] staging isolation: telegram bot side-effects and admin broadcasts disabled')
}

const app = express()
const proxyHops = trustProxyHops()
if (proxyHops !== false) {
  app.set('trust proxy', proxyHops)
  console.log('[TCG] trust proxy hops =', proxyHops)
}

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true)
    if (allowedOrigins.includes(origin)) return cb(null, true)
    cb(null, false)
  },
  // Same-origin reverse proxy (WEB-DOMAIN/api) does not need credentialed CORS.
  // When WEB and API are temporarily on different origins during local/dev, cookies need this.
  // Never pair credentials with Access-Control-Allow-Origin: *.
  credentials: true,
}))
app.use(express.json({ limit: '2mb' }))

app.use('/public', express.static(path.join(process.cwd(), 'public'), {
  setHeaders(res, filePath) {
    if (filePath.endsWith('.png')) res.setHeader('Content-Type', 'image/png')
  },
}))

function sendHealth(_req: express.Request, res: express.Response) {
  res.status(200).json({
    ok: true,
    service: 'gnh',
    env: isStagingRuntime() ? 'staging' : 'app',
  })
}

// Health check — always 200, no DB
app.get('/health', sendHealth)
app.get('/api/health', sendHealth)

// Telegram webhook — must be before other routes, always 200
app.post(BOT_WEBHOOK_PATH, async (req, res) => {
  if (telegramBotSideEffectsDisabled()) {
    console.log('[telegram] webhook ignored (staging / bot side-effects disabled)')
    res.status(200).send('ok')
    return
  }
  console.log('[telegram] POST', BOT_WEBHOOK_PATH)
  if (req.body?.update_id != null) {
    console.log('[telegram] update_id', req.body.update_id)
  }
  try {
    if (bot) {
      await bot.handleUpdate(req.body, res)
      if (!res.headersSent) {
        res.sendStatus(200)
      }
      console.log('[telegram] handled update', req.body?.update_id)
    } else {
      res.status(200).send('ok')
    }
  } catch (e) {
    console.error('[telegram] webhook error:', e instanceof Error ? e.message : 'error')
    if (!res.headersSent) {
      res.status(200).send('ok')
    }
  }
})

// API base = /api — все роуты доступны как /api/...
app.use('/api', authRouter)
app.use('/api', webAuthRouter)
app.use('/api', premiumRouter)
app.use('/api', meRouter)
app.use('/api', plansRouter)
app.use('/api', yookassaRouter) // YooKassa webhook: POST /api/yookassa/webhook
app.use('/api', apiRouter)
app.use('/api', eventsRouter)
app.use('/api', publicStatsRouter)
app.use('/api/admin', adminRouter)
app.use('/api/sled', sledRoomsRouter)
app.use('/api/games/mafia-shadows', mafiaShadowsRouter)
app.use('/api/games/doubles', doublesRouter)
app.use('/api/games/infected', infectedRouter)
app.use(
  '/api/legal',
  createLegalRouter({
    query: db,
    withTransaction,
    verifyInitData,
    getBotToken: () => process.env.TELEGRAM_BOT_TOKEN ?? process.env.BOT_TOKEN ?? '',
    getPlan: async (planId) => {
      const plan = await getActivePlanById(planId)
      if (!plan) return null
      return {
        planId: plan.plan_id,
        title: plan.title,
        priceRub: plan.price_rub,
        durationDays: plan.duration_days,
      }
    },
  })
)
app.use('/legal', createLegalHtmlRouter({ query: db }))

// Optional same-origin WEB: Express serves dist-web + SPA fallback after API routes.
// Controlled by GNH_WEB_ENABLED + GNH_SERVE_WEB_STATIC (never used by Mini App shell).
if (serveWebStaticEnabled()) {
  // Prefer server/web-dist (Timeweb Project directory=/server sidecar build),
  // then ../dist-web (local monorepo), unless GNH_WEB_STATIC_DIR is set.
  const defaultWebRoots = [
    path.join(process.cwd(), 'web-dist'),
    path.join(process.cwd(), '..', 'dist-web'),
  ]
  const configured = process.env.GNH_WEB_STATIC_DIR?.trim()
  const webRoot = path.resolve(
    configured || defaultWebRoots.find((dir) => fs.existsSync(path.join(dir, 'index.html'))) || defaultWebRoots[0]
  )
  if (!fs.existsSync(path.join(webRoot, 'index.html'))) {
    console.warn('[TCG] GNH_SERVE_WEB_STATIC set but index.html missing at', webRoot)
  } else {
    console.log('[TCG] serving WEB static from', webRoot)
    app.use(express.static(webRoot, { index: false, maxAge: '1h' }))
    app.get('*', (req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next()
      if (
        req.path.startsWith('/api') ||
        req.path.startsWith('/legal') ||
        req.path.startsWith('/public') ||
        req.path === '/health' ||
        req.path === BOT_WEBHOOK_PATH
      ) {
        return next()
      }
      res.sendFile(path.join(webRoot, 'index.html'), (err) => {
        if (err) next(err)
      })
    })
  }
}

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[TCG] unhandled error:', err instanceof Error ? err.message : 'error')
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal server error', code: 'internal_error' })
  }
})

// HTTP server (webhook mode — no bot.launch/polling)
app.listen(port, '0.0.0.0', () => {
  console.log(`[TCG] HTTP server listening on port ${port}`)
})
