import { query } from '../db.js'

export async function ensureUser(telegramId: number): Promise<void> {
  await query(
    'INSERT INTO users (telegram_id) VALUES ($1) ON CONFLICT (telegram_id) DO NOTHING',
    [telegramId]
  )
}

export async function upsertSubscription(
  telegramId: number,
  planId: string,
  activeUntil: Date
): Promise<void> {
  await query(
    `INSERT INTO subscriptions (telegram_id, plan_id, active_until)
     VALUES ($1, $2, $3)
     ON CONFLICT (telegram_id, plan_id)
     DO UPDATE SET active_until = EXCLUDED.active_until`,
    [telegramId, planId, activeUntil]
  )
}

export async function getActiveSubscription(
  telegramId: number,
  planId: string
): Promise<Date | null> {
  const res = await query<{ active_until: Date }>(
    `SELECT active_until FROM subscriptions
     WHERE telegram_id = $1 AND plan_id = $2
     LIMIT 1`,
    [telegramId, planId]
  )
  const row = res.rows[0]
  return row ? new Date(row.active_until) : null
}
