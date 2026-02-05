import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import authRouter from './routes/auth.js'
import premiumRouter from './routes/premium.js'
import meRouter from './routes/me.js'
import apiRouter from './api.js'
import { launchBot } from './bot.js'

const port = Number(process.env.PORT || 3001)
const corsOriginRaw = process.env.CORS_ORIGIN || 'http://localhost:5173'
const corsOrigins = corsOriginRaw.split(',').map((o) => o.trim()).filter(Boolean)

console.log('[TCG] ENV PORT =', process.env.PORT)

const app = express()
app.use(cors({
  origin: corsOrigins.length > 1 ? corsOrigins : (corsOrigins[0] || true),
}))
app.use(express.json())

// Health check — always 200, no DB
app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true })
})

// API base = /api
app.use('/api', authRouter)
app.use('/api', premiumRouter)
app.use('/api', meRouter)
app.use('/api', apiRouter)

// HTTP server must listen BEFORE bot (Render port scan)
app.listen(port, '0.0.0.0', () => {
  console.log(`[TCG] HTTP server listening on port ${port}`)
  // Launch bot in background — must not block HTTP
  launchBot()
    .then(() => console.log('[TCG] Bot launched'))
    .catch((e) => console.error('[TCG] Bot launch failed:', e instanceof Error ? e.message : e))
})
