import { marketingChannelOpen } from './consents.js'
import type { Queryable, TransactionRunner } from './types.js'

export type MarketingMessage =
  | { kind: 'text'; text: string; replyMarkup?: unknown }
  | { kind: 'photo'; photo: string; caption: string; replyMarkup?: unknown }

export type BroadcastResult = {
  totalSelected: number
  sentCount: number
  failedCount: number
  skippedCount: number
  failures: Array<{ telegramId: number; error: string }>
  queueIds: number[]
}

type QueueRow = { id: string | number; subject_telegram_id: string | number }

const OPEN_PREFERENCE = `p.state = 'granted'
  AND p.withdrawn_at IS NULL
  AND p.valid_until > now()
  AND p.document_version = v.version
  AND p.document_sha256 = v.sha256`

function preferenceExists(documentId: string, channelParam: string): string {
  return `EXISTS (
    SELECT 1
    FROM legal_preferences p
    JOIN legal_document_activations a
      ON a.document_id = p.document_id AND a.deactivated_at IS NULL
    JOIN legal_document_versions v ON v.id = a.document_version_id
    WHERE p.subject_telegram_id = u.telegram_id
      AND p.document_id = '${documentId}'
      AND p.channel = ${channelParam}
      AND ${OPEN_PREFERENCE}
  )`
}

export async function enqueueMarketing(
  withTransaction: TransactionRunner,
  input: {
    channel: 'telegram'
    limit: number
    offset: number
    createdAfter: string | null
    onlyTelegramId: number | null
    message: MarketingMessage
  }
): Promise<{ totalSelected: number; queue: Array<{ id: number; telegramId: number }> }> {
  return withTransaction(async (queryable) => {
    const selected = await queryable.query<{ telegram_id: string | number }>(
      `SELECT u.telegram_id
       FROM users u
       WHERE ($1::bigint IS NULL OR u.telegram_id = $1::bigint)
         AND ($2::timestamptz IS NULL OR u.created_at > $2::timestamptz)
         AND ${preferenceExists('marketing_permission', '$3')}
         AND ${preferenceExists('marketing_pd', '$3')}
       ORDER BY u.created_at ASC, u.telegram_id ASC
       LIMIT $4 OFFSET $5`,
      [input.onlyTelegramId, input.createdAfter, input.channel, input.limit, input.offset]
    )
    const queue: Array<{ id: number; telegramId: number }> = []
    for (const row of selected.rows) {
      const inserted = await queryable.query<QueueRow>(
        `INSERT INTO marketing_queue (subject_telegram_id, channel, payload, status)
         VALUES ($1::bigint, $2, $3::jsonb, 'pending')
         RETURNING id, subject_telegram_id`,
        [row.telegram_id, input.channel, JSON.stringify(input.message)]
      )
      const queued = inserted.rows[0]
      if (!queued) continue
      queue.push({ id: Number(queued.id), telegramId: Number(queued.subject_telegram_id) })
    }
    return { totalSelected: selected.rows.length, queue }
  })
}

async function claimIfStillAllowed(
  queryable: Queryable,
  queueId: number,
  channel: 'telegram'
): Promise<number | null> {
  const locked = await queryable.query<QueueRow>(
    `UPDATE marketing_queue
     SET status = 'sending'
     WHERE id = $1 AND status = 'pending'
     RETURNING id, subject_telegram_id`,
    [queueId]
  )
  const row = locked.rows[0]
  if (!row) return null
  const telegramId = Number(row.subject_telegram_id)
  const open = await marketingChannelOpen(queryable, telegramId, channel)
  if (!open) {
    await queryable.query(
      `UPDATE marketing_queue
       SET status = 'cancelled', cancelled_at = now(), cancel_reason = 'consent_withdrawn'
       WHERE id = $1 AND status = 'sending'`,
      [queueId]
    )
    return null
  }
  return telegramId
}

export async function deliverMarketingQueueItem(
  deps: { query: Queryable; withTransaction: TransactionRunner },
  input: { queueId: number; channel: 'telegram'; send: (telegramId: number) => Promise<void> }
): Promise<'sent' | 'skipped' | 'failed'> {
  const telegramId = await deps.withTransaction((queryable) => claimIfStillAllowed(queryable, input.queueId, input.channel))
  if (telegramId == null) return 'skipped'
  const stillOpen = await marketingChannelOpen(deps.query, telegramId, input.channel)
  if (!stillOpen) {
    await deps.query.query(
      `UPDATE marketing_queue
       SET status = 'cancelled', cancelled_at = now(), cancel_reason = 'consent_withdrawn'
       WHERE id = $1 AND status = 'sending'`,
      [input.queueId]
    )
    return 'skipped'
  }
  try {
    await input.send(telegramId)
  } catch (error) {
    await deps.query.query(
      `UPDATE marketing_queue SET status = 'failed', cancel_reason = 'send_failed' WHERE id = $1 AND status = 'sending'`,
      [input.queueId]
    )
    throw error
  }
  await deps.query.query(
    `UPDATE marketing_queue SET status = 'sent', sent_at = now() WHERE id = $1 AND status = 'sending'`,
    [input.queueId]
  )
  return 'sent'
}

export async function runConsentedBroadcast(
  deps: { query: Queryable; withTransaction: TransactionRunner },
  input: {
    channel: 'telegram'
    limit: number
    offset: number
    createdAfter: string | null
    onlyTelegramId: number | null
    message: MarketingMessage
    send: (telegramId: number) => Promise<void>
  }
): Promise<BroadcastResult> {
  const enqueued = await enqueueMarketing(deps.withTransaction, input)
  const result: BroadcastResult = {
    totalSelected: enqueued.totalSelected,
    sentCount: 0,
    failedCount: 0,
    skippedCount: 0,
    failures: [],
    queueIds: enqueued.queue.map((item) => item.id),
  }
  for (const item of enqueued.queue) {
    try {
      const outcome = await deliverMarketingQueueItem(deps, {
        queueId: item.id,
        channel: input.channel,
        send: input.send,
      })
      if (outcome === 'sent') result.sentCount += 1
      else result.skippedCount += 1
    } catch (error) {
      result.failedCount += 1
      result.failures.push({
        telegramId: item.telegramId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
  return result
}
