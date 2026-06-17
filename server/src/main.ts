import 'dotenv/config'
import path from 'node:path'
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
import { bot } from './bot.js'

const port = Number(process.env.PORT || 3001)
const corsOriginRaw = process.env.CORS_ORIGIN || 'http://localhost:5173'
const corsOrigins = corsOriginRaw.split(',').map((o) => o.trim()).filter(Boolean)
const localhostOrigins = ['http://localhost:4173', 'http://localhost:5173', 'http://127.0.0.1:4173', 'http://127.0.0.1:5173']
const allowedOrigins = [...new Set([...corsOrigins, ...localhostOrigins])]

const BOT_WEBHOOK_PATH = (process.env.BOT_WEBHOOK_PATH || '/telegram/webhook-9f3k2lQp').replace(/\/+$/, '')

console.log('[TCG] ENV PORT =', process.env.PORT)

if (process.env.DATABASE_URL) {
  const u = new URL(process.env.DATABASE_URL)
  console.log('[DB] user=', u.username, 'host=', u.host, 'port=', u.port, 'db=', u.pathname)
}

const app = express()
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true)
    if (allowedOrigins.includes(origin)) return cb(null, true)
    cb(null, false)
  },
}))
app.use(express.json({ limit: '2mb' }))

app.use('/public', express.static(path.join(process.cwd(), 'public'), {
  setHeaders(res, filePath) {
    if (filePath.endsWith('.png')) res.setHeader('Content-Type', 'image/png')
  },
}))

// Health check — always 200, no DB
app.get('/health', (_req, res) => {
  res.status(200).send('ok')
})

// Telegram webhook — must be before other routes, always 200
app.post(BOT_WEBHOOK_PATH, async (req, res) => {
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
    console.error('[telegram] webhook error:', e)
    if (!res.headersSent) {
      res.status(200).send('ok')
    }
  }
})

// API base = /api — все роуты доступны как /api/...
app.use('/api', authRouter)
app.use('/api', premiumRouter)
app.use('/api', meRouter)
app.use('/api', plansRouter)
app.use('/api', yookassaRouter) // YooKassa webhook: POST /api/yookassa/webhook
app.use('/api', apiRouter)
app.use('/api', eventsRouter)
app.use('/api', publicStatsRouter)
app.use('/api/admin', adminRouter)

// HTTP server (webhook mode — no bot.launch/polling)
app.listen(port, '0.0.0.0', () => {
  console.log(`[TCG] HTTP server listening on port ${port}`)
})
