/**
 * Premium storage: memoryStore (fast) + PostgreSQL (persistent).
 * Bot saves to both; /api/me reads from memory, falls back to DB if empty.
 */

import { getUser, setPremium, isPremium } from './memoryStore.js'

const PLAN_ID = 'premium'

async function upsertPremiumDb(telegramId: number, activeUntil: Date): Promise<void> {
  if (!process.env.DATABASE_URL) return
  try {
    const { query } = await import('./db/client.js')
    await query(
      `INSERT INTO users (telegram_id) VALUES ($1) ON CONFLICT (telegram_id) DO NOTHING`,
      [telegramId]
    )
    await query(
      `INSERT INTO subscriptions (telegram_id, plan_id, active_until)
       VALUES ($1, $2, $3)
       ON CONFLICT (telegram_id, plan_id) DO UPDATE SET active_until = $3`,
      [telegramId, PLAN_ID, activeUntil]
    )
  } catch {
    // DB unavailable — memoryStore still has it
  }
}

async function getPremiumFromDb(telegramId: number): Promise<{ premiumUntil: number } | null> {
  if (!process.env.DATABASE_URL) return null
  try {
    const { query } = await import('./db/client.js')
    const res = await query<{ active_until: Date }>(
      `SELECT active_until FROM subscriptions WHERE telegram_id = $1 AND plan_id = $2`,
      [telegramId, PLAN_ID]
    )
    const row = res.rows[0]
    if (!row) return null
    const ts = new Date(row.active_until).getTime()
    return { premiumUntil: ts }
  } catch {
    return null
  }
}

export function setPremiumWithPersistence(telegramId: number, premiumUntil: number): void {
  setPremium(telegramId, premiumUntil)
  const activeUntil = new Date(premiumUntil)
  upsertPremiumDb(telegramId, activeUntil).catch((e) =>
    console.warn('[premiumStore] DB save failed:', e instanceof Error ? e.message : e)
  )
}

export function getUserPremium(telegramId: number): { premiumUntil: number } | null {
  const mem = getUser(telegramId)
  if (mem?.premiumUntil != null) return { premiumUntil: mem.premiumUntil }
  return null
}

export async function getUserPremiumWithDb(telegramId: number): Promise<{
  premium: boolean
  premiumUntil: string | null
}> {
  const mem = getUser(telegramId)
  if (mem?.premiumUntil) {
    const premium = mem.premiumUntil > Date.now()
    return {
      premium,
      premiumUntil: new Date(mem.premiumUntil).toISOString(),
    }
  }
  const db = await getPremiumFromDb(telegramId)
  if (db) {
    setPremium(telegramId, db.premiumUntil)
    const premium = db.premiumUntil > Date.now()
    return {
      premium,
      premiumUntil: new Date(db.premiumUntil).toISOString(),
    }
  }
  return { premium: false, premiumUntil: null }
}

export { isPremium }
