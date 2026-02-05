import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import authRouter from './routes/auth.js'
import premiumRouter from './routes/premium.js'
import meRouter from './routes/me.js'
import apiRouter from './api.js'
import { launchBot } from './bot.js'

const isDev = process.env.NODE_ENV !== 'production'
const PORT = Number(process.env.PORT) || 3000
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173'

const app = express()
app.use(cors({ origin: corsOrigin }))
app.use(express.json())

// Health check first — always 200, no DB
app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true })
})

// API base = /api
app.use('/api', authRouter)
app.use('/api', premiumRouter)
app.use('/api', meRouter)
app.use('/api', apiRouter)

async function start() {
  try {
    await launchBot()
    console.log('[BOT] launched')
  } catch (e) {
    console.error('[BOT] launch failed:', e)
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Listening on ${PORT}`)
    if (isDev) {
      console.log(`[TCG] Health: http://localhost:${PORT}/health`)
      if (!process.env.TELEGRAM_BOT_TOKEN) {
        console.warn('[TCG] TELEGRAM_BOT_TOKEN not set — bot will not start')
      }
    }
  })
}

start()
