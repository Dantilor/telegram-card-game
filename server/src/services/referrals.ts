import { query } from '../db.js'

const pendingReferrals = new Map<number, number>()

export function savePendingReferral(invitedTelegramId: number, inviterTelegramId: number): void {
  pendingReferrals.set(invitedTelegramId, inviterTelegramId)
}

export function getPendingReferral(invitedTelegramId: number): number | null {
  return pendingReferrals.get(invitedTelegramId) ?? null
}

export function clearPendingReferral(invitedTelegramId: number): void {
  pendingReferrals.delete(invitedTelegramId)
}

export async function finalizePendingReferral(invitedTelegramId: number): Promise<void> {
  const inviterTelegramId = getPendingReferral(invitedTelegramId)
  if (!inviterTelegramId) return

  if (inviterTelegramId === invitedTelegramId) {
    clearPendingReferral(invitedTelegramId)
    return
  }

  const currentUser = await query<{ referred_by: number | null }>(
    'SELECT referred_by FROM users WHERE telegram_id = $1 LIMIT 1',
    [invitedTelegramId]
  )

  const currentRow = currentUser.rows[0]
  if (!currentRow) return

  if (currentRow.referred_by != null) {
    clearPendingReferral(invitedTelegramId)
    return
  }

  const inviterExists = await query<{ n: number }>(
    'SELECT 1 AS n FROM users WHERE telegram_id = $1 LIMIT 1',
    [inviterTelegramId]
  )

  if (inviterExists.rows.length === 0) {
    return
  }

  const updated = await query<{ telegram_id: number }>(
    `UPDATE users
     SET referred_by = $2, referred_at = NOW()
     WHERE telegram_id = $1
       AND referred_by IS NULL
       AND telegram_id <> $2
     RETURNING telegram_id`,
    [invitedTelegramId, inviterTelegramId]
  )

  if (updated.rows.length > 0) {
    clearPendingReferral(invitedTelegramId)
  }
}
