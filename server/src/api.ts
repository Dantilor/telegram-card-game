import express, { Request, Response } from 'express'
import { query } from './db.js'

const api = express.Router()
api.use(express.json())

// Debug ping — no initData needed
api.get('/debug/ping', (_req: Request, res: Response) => {
  res.status(200).json({ ok: true, time: new Date().toISOString() })
})

// Debug DB — no initData needed, checks pool connection
api.get('/debug/db', async (_req: Request, res: Response) => {
  try {
    const r = await query<{ ok: number }>('SELECT 1 as ok')
    if (r.rows[0]?.ok === 1) {
      res.status(200).json({ ok: true })
    } else {
      res.status(500).json({ ok: false, error: 'Unexpected result' })
    }
  } catch (e) {
    console.error('[API] /api/debug/db error:', e)
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) })
  }
})

export default api
