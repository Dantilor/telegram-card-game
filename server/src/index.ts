import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import authRouter from './routes/auth.js'
import premiumRouter from './routes/premium.js'
import meRouter from './routes/me.js'
import apiRouter from './api.js'

const isDev = process.env.NODE_ENV !== 'production'
const port = Number(process.env.PORT) || 3001
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

app.listen(port, () => {
  console.log(`[TCG] Server listening on port ${port}`)
  if (isDev) {
    console.log(`[TCG] Health: http://localhost:${port}/health`)
    if (!process.env.DATABASE_URL) {
      console.warn('[TCG] DATABASE_URL not set — DB routes will fail')
    }
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      console.warn('[TCG] TELEGRAM_BOT_TOKEN not set — auth/premium will fail')
    }
  }
})
