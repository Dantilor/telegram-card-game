import type { Queryable } from '../legal/types.js'
import { query as defaultQuery } from '../db.js'
import { randomToken, sha256Hex } from './cryptoTokens.js'

export const WEB_DEVICE_LIMIT = 3
export const WEB_DEVICE_IDLE_MS = 30 * 24 * 60 * 60_000
export const DEVICE_COOKIE = process.env.WEB_DEVICE_COOKIE_NAME?.trim() || 'gnh_web_device'
export const DEVICE_COOKIE_MAX_AGE_SEC = 400 * 24 * 60 * 60

type Db = {
  query: <T>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>
}

function db(custom?: Queryable): Db {
  if (custom) {
    return {
      query: async <T>(sql: string, params?: unknown[]) => {
        const result = await custom.query<T>(sql, params)
        return { rows: result.rows as T[] }
      },
    }
  }
  return {
    query: async <T>(sql: string, params?: unknown[]) => {
      const result = await defaultQuery(sql, params)
      return { rows: result.rows as T[] }
    },
  }
}

export function webDeviceLimitEnabled(): boolean {
  return (
    process.env.GNH_WEB_DEVICE_LIMIT_ENABLED === '1' ||
    process.env.GNH_WEB_DEVICE_LIMIT_ENABLED === 'true'
  )
}

export function hashDeviceToken(token: string): string {
  return sha256Hex(token.trim())
}

export function mintDeviceToken(): string {
  return randomToken(32)
}

export type WebTelegramDeviceRow = {
  id: string
  telegram_id: string
  web_account_id: string
  device_token_hash: string
  display_label: string | null
  linked_at: Date
  last_active_at: Date
  idle_expires_at: Date
  revoked_at: Date | null
  revoke_reason: string | null
  is_legacy: boolean
}

export type PublicDeviceView = {
  id: string
  label: string
  linkedAt: string
  lastActiveAt: string
  isCurrent: boolean
  isLegacy: boolean
}

function idleExpiresAt(from = new Date()): Date {
  return new Date(from.getTime() + WEB_DEVICE_IDLE_MS)
}

export async function expireIdleDevices(
  telegramId: number | null | undefined,
  customDb?: Queryable
): Promise<number> {
  if (telegramId != null && Number.isFinite(telegramId)) {
    const result = await db(customDb).query<{ id: string }>(
      `UPDATE web_telegram_devices
          SET revoked_at = now(),
              revoke_reason = 'idle_expire'
        WHERE telegram_id = $1::bigint
          AND revoked_at IS NULL
          AND idle_expires_at < now()
        RETURNING id`,
      [telegramId]
    )
    return result.rows.length
  }
  const result = await db(customDb).query<{ id: string }>(
    `UPDATE web_telegram_devices
        SET revoked_at = now(),
            revoke_reason = 'idle_expire'
      WHERE revoked_at IS NULL
        AND idle_expires_at < now()
      RETURNING id`
  )
  return result.rows.length
}

async function advisoryLockTelegram(telegramId: number, customDb?: Queryable): Promise<void> {
  // Two-int advisory lock derived from telegram id (stable within transaction).
  const hi = Math.floor(Number(telegramId) / 2147483647) || 1
  const lo = Number(telegramId) % 2147483647
  try {
    await db(customDb).query(`SELECT pg_advisory_xact_lock($1::int, $2::int)`, [hi, lo])
  } catch {
    // PGlite / older engines may lack advisory locks — still serialize via FOR UPDATE rows.
  }
}

export async function countActiveDevices(
  telegramId: number,
  customDb?: Queryable
): Promise<number> {
  await expireIdleDevices(telegramId, customDb)
  const result = await db(customDb).query<{ c: string }>(
    `SELECT count(*)::text AS c
       FROM web_telegram_devices
      WHERE telegram_id = $1::bigint
        AND revoked_at IS NULL`,
    [telegramId]
  )
  return Number(result.rows[0]?.c || 0)
}

export async function findActiveDeviceByTokenHash(
  tokenHash: string,
  customDb?: Queryable
): Promise<WebTelegramDeviceRow | null> {
  if (!tokenHash || tokenHash.length !== 64) return null
  const result = await db(customDb).query<WebTelegramDeviceRow>(
    `SELECT id, telegram_id::text AS telegram_id, web_account_id::text AS web_account_id,
            device_token_hash, display_label, linked_at, last_active_at, idle_expires_at,
            revoked_at, revoke_reason, is_legacy
       FROM web_telegram_devices
      WHERE device_token_hash = $1
        AND revoked_at IS NULL
      LIMIT 1`,
    [tokenHash]
  )
  const row = result.rows[0]
  if (!row) return null
  if (new Date(row.idle_expires_at).getTime() <= Date.now()) {
    await db(customDb).query(
      `UPDATE web_telegram_devices
          SET revoked_at = now(), revoke_reason = 'idle_expire'
        WHERE id = $1::uuid AND revoked_at IS NULL`,
      [row.id]
    )
    return null
  }
  return row
}

export async function hasActiveDeviceForAccount(
  input: { webAccountId: string; deviceTokenHash?: string | null; telegramId?: number | null },
  customDb?: Queryable
): Promise<boolean> {
  if (input.deviceTokenHash) {
    const byToken = await findActiveDeviceByTokenHash(input.deviceTokenHash, customDb)
    if (byToken && byToken.web_account_id === input.webAccountId) return true
  }
  // Legacy: account still has an unclaimed legacy slot (pre-device-cookie installs).
  if (!webDeviceLimitEnabled()) {
    const link = await db(customDb).query<{ c: string }>(
      `SELECT count(*)::text AS c
         FROM web_telegram_links
        WHERE web_account_id = $1::uuid AND revoked_at IS NULL`,
      [input.webAccountId]
    )
    return Number(link.rows[0]?.c || 0) > 0
  }
  const legacy = await db(customDb).query<{ id: string }>(
    `SELECT id::text AS id
       FROM web_telegram_devices
      WHERE web_account_id = $1::uuid
        AND revoked_at IS NULL
        AND is_legacy = true
        AND idle_expires_at > now()
      LIMIT 1`,
    [input.webAccountId]
  )
  if (legacy.rows[0]) {
    // Keep transitional Premium alive until the browser claims a real device cookie.
    await touchDeviceActivity(legacy.rows[0].id, customDb)
    return true
  }
  return false
}

export async function touchDeviceActivity(
  deviceId: string,
  customDb?: Queryable
): Promise<void> {
  const nextIdle = idleExpiresAt()
  await db(customDb).query(
    `UPDATE web_telegram_devices
        SET last_active_at = now(),
            idle_expires_at = $2
      WHERE id = $1::uuid
        AND revoked_at IS NULL`,
    [deviceId, nextIdle.toISOString()]
  )
}

export type RegisterDeviceResult =
  | {
      ok: true
      device: WebTelegramDeviceRow
      created: boolean
      devicesUsed: number
      deviceToken?: string
    }
  | {
      ok: false
      code: 'device_limit_reached'
      devicesUsed: number
      devicesLimit: number
    }

/**
 * Register/reuse a device when WEB only stored the hash on the link challenge
 * (Mini App complete cannot read the WEB origin cookie).
 */
export async function registerDeviceFromChallengeHash(input: {
  telegramId: number
  webAccountId: string
  deviceTokenHash: string | null | undefined
  displayLabel?: string | null
  db?: Queryable
}): Promise<RegisterDeviceResult> {
  const customDb = input.db
  await advisoryLockTelegram(input.telegramId, customDb)
  await expireIdleDevices(input.telegramId, customDb)

  const hash = (input.deviceTokenHash || '').trim().toLowerCase()
  if (hash && /^[0-9a-f]{64}$/.test(hash)) {
    const existing = await findActiveDeviceByTokenHash(hash, customDb)
    if (
      existing &&
      Number(existing.telegram_id) === input.telegramId &&
      existing.web_account_id === input.webAccountId
    ) {
      await touchDeviceActivity(existing.id, customDb)
      return {
        ok: true,
        device: existing,
        created: false,
        devicesUsed: await countActiveDevices(input.telegramId, customDb),
      }
    }

    const legacy = await db(customDb).query<WebTelegramDeviceRow>(
      `SELECT id, telegram_id::text AS telegram_id, web_account_id::text AS web_account_id,
              device_token_hash, display_label, linked_at, last_active_at, idle_expires_at,
              revoked_at, revoke_reason, is_legacy
         FROM web_telegram_devices
        WHERE telegram_id = $1::bigint
          AND web_account_id = $2::uuid
          AND revoked_at IS NULL
          AND is_legacy = true
        ORDER BY linked_at ASC
        LIMIT 1
        FOR UPDATE`,
      [input.telegramId, input.webAccountId]
    )
    const label = (input.displayLabel || '').trim().slice(0, 120) || null
    if (legacy.rows[0]) {
      const updated = await db(customDb).query<WebTelegramDeviceRow>(
        `UPDATE web_telegram_devices
            SET device_token_hash = $2,
                display_label = COALESCE($3, display_label),
                last_active_at = now(),
                idle_expires_at = $4,
                is_legacy = false,
                revoke_reason = NULL
          WHERE id = $1::uuid
          RETURNING id, telegram_id::text AS telegram_id, web_account_id::text AS web_account_id,
                    device_token_hash, display_label, linked_at, last_active_at, idle_expires_at,
                    revoked_at, revoke_reason, is_legacy`,
        [legacy.rows[0].id, hash, label, idleExpiresAt().toISOString()]
      )
      return {
        ok: true,
        device: updated.rows[0]!,
        created: false,
        devicesUsed: await countActiveDevices(input.telegramId, customDb),
      }
    }

    // Same hash already active under this telegram (idempotent cross-account claim after adoption).
    if (existing && Number(existing.telegram_id) === input.telegramId) {
      await touchDeviceActivity(existing.id, customDb)
      return {
        ok: true,
        device: existing,
        created: false,
        devicesUsed: await countActiveDevices(input.telegramId, customDb),
      }
    }

    const usedBefore = await countActiveDevices(input.telegramId, customDb)
    if (usedBefore >= WEB_DEVICE_LIMIT) {
      return {
        ok: false,
        code: 'device_limit_reached',
        devicesUsed: usedBefore,
        devicesLimit: WEB_DEVICE_LIMIT,
      }
    }

    try {
      const inserted = await db(customDb).query<WebTelegramDeviceRow>(
        `INSERT INTO web_telegram_devices (
            telegram_id, web_account_id, device_token_hash, display_label,
            idle_expires_at, is_legacy
          ) VALUES ($1::bigint, $2::uuid, $3, $4, $5, false)
          RETURNING id, telegram_id::text AS telegram_id, web_account_id::text AS web_account_id,
                    device_token_hash, display_label, linked_at, last_active_at, idle_expires_at,
                    revoked_at, revoke_reason, is_legacy`,
        [input.telegramId, input.webAccountId, hash, label, idleExpiresAt().toISOString()]
      )
      return {
        ok: true,
        device: inserted.rows[0]!,
        created: true,
        devicesUsed: await countActiveDevices(input.telegramId, customDb),
      }
    } catch {
      // Unique race on token hash: treat as reuse.
      const raced = await findActiveDeviceByTokenHash(hash, customDb)
      if (raced && Number(raced.telegram_id) === input.telegramId) {
        return {
          ok: true,
          device: raced,
          created: false,
          devicesUsed: await countActiveDevices(input.telegramId, customDb),
        }
      }
      throw new Error('device_register_failed')
    }
  }

  // No hash from challenge — mint a new device token (rare fallback).
  return registerOrReuseDevice({
    telegramId: input.telegramId,
    webAccountId: input.webAccountId,
    displayLabel: input.displayLabel,
    db: customDb,
  })
}

/**
 * Register or reuse a device slot for telegram+account.
 * Must run inside a transaction when called from /complete.
 */
export async function registerOrReuseDevice(input: {
  telegramId: number
  webAccountId: string
  deviceToken?: string | null
  displayLabel?: string | null
  db?: Queryable
}): Promise<RegisterDeviceResult> {
  const customDb = input.db
  await advisoryLockTelegram(input.telegramId, customDb)
  await expireIdleDevices(input.telegramId, customDb)

  const existingHash = input.deviceToken?.trim()
    ? hashDeviceToken(input.deviceToken.trim())
    : null
  if (existingHash) {
    const existing = await findActiveDeviceByTokenHash(existingHash, customDb)
    if (
      existing &&
      Number(existing.telegram_id) === input.telegramId &&
      existing.web_account_id === input.webAccountId
    ) {
      await touchDeviceActivity(existing.id, customDb)
      const used = await countActiveDevices(input.telegramId, customDb)
      return { ok: true, device: existing, created: false, devicesUsed: used }
    }
  }

  // Claim legacy slot for this account instead of consuming a new slot.
  const legacy = await db(customDb).query<WebTelegramDeviceRow>(
    `SELECT id, telegram_id::text AS telegram_id, web_account_id::text AS web_account_id,
            device_token_hash, display_label, linked_at, last_active_at, idle_expires_at,
            revoked_at, revoke_reason, is_legacy
       FROM web_telegram_devices
      WHERE telegram_id = $1::bigint
        AND web_account_id = $2::uuid
        AND revoked_at IS NULL
        AND is_legacy = true
      ORDER BY linked_at ASC
      LIMIT 1
      FOR UPDATE`,
    [input.telegramId, input.webAccountId]
  )
  const mint = input.deviceToken?.trim() || mintDeviceToken()
  const hash = hashDeviceToken(mint)
  const label = (input.displayLabel || '').trim().slice(0, 120) || null

  if (legacy.rows[0]) {
    const updated = await db(customDb).query<WebTelegramDeviceRow>(
      `UPDATE web_telegram_devices
          SET device_token_hash = $2,
              display_label = COALESCE($3, display_label),
              last_active_at = now(),
              idle_expires_at = $4,
              is_legacy = false,
              revoke_reason = NULL
        WHERE id = $1::uuid
        RETURNING id, telegram_id::text AS telegram_id, web_account_id::text AS web_account_id,
                  device_token_hash, display_label, linked_at, last_active_at, idle_expires_at,
                  revoked_at, revoke_reason, is_legacy`,
      [legacy.rows[0].id, hash, label, idleExpiresAt().toISOString()]
    )
    const used = await countActiveDevices(input.telegramId, customDb)
    return {
      ok: true,
      device: updated.rows[0]!,
      created: false,
      devicesUsed: used,
      deviceToken: mint,
    }
  }

  const usedBefore = await countActiveDevices(input.telegramId, customDb)
  // Never create a 4th slot. When the feature flag is off, /complete soft-skips this error
  // so linking/Premium-by-link still succeeds without a new device row.
  if (usedBefore >= WEB_DEVICE_LIMIT) {
    return {
      ok: false,
      code: 'device_limit_reached',
      devicesUsed: usedBefore,
      devicesLimit: WEB_DEVICE_LIMIT,
    }
  }

  const inserted = await db(customDb).query<WebTelegramDeviceRow>(
    `INSERT INTO web_telegram_devices (
        telegram_id, web_account_id, device_token_hash, display_label,
        idle_expires_at, is_legacy
      ) VALUES ($1::bigint, $2::uuid, $3, $4, $5, false)
      RETURNING id, telegram_id::text AS telegram_id, web_account_id::text AS web_account_id,
                device_token_hash, display_label, linked_at, last_active_at, idle_expires_at,
                revoked_at, revoke_reason, is_legacy`,
    [input.telegramId, input.webAccountId, hash, label, idleExpiresAt().toISOString()]
  )
  const used = await countActiveDevices(input.telegramId, customDb)
  return {
    ok: true,
    device: inserted.rows[0]!,
    created: true,
    devicesUsed: used,
    deviceToken: mint,
  }
}

export async function listDevicesForTelegram(
  telegramId: number,
  currentTokenHash: string | null | undefined,
  customDb?: Queryable
): Promise<{ devices: PublicDeviceView[]; devicesUsed: number; devicesLimit: number }> {
  await expireIdleDevices(telegramId, customDb)
  const result = await db(customDb).query<WebTelegramDeviceRow>(
    `SELECT id, telegram_id::text AS telegram_id, web_account_id::text AS web_account_id,
            device_token_hash, display_label, linked_at, last_active_at, idle_expires_at,
            revoked_at, revoke_reason, is_legacy
       FROM web_telegram_devices
      WHERE telegram_id = $1::bigint
        AND revoked_at IS NULL
      ORDER BY linked_at ASC`,
    [telegramId]
  )
  const devices = result.rows.map((row) => ({
    id: row.id,
    label: row.display_label?.trim() || (row.is_legacy ? 'Current device' : 'WEB device'),
    linkedAt: new Date(row.linked_at).toISOString(),
    lastActiveAt: new Date(row.last_active_at).toISOString(),
    isCurrent: Boolean(currentTokenHash && row.device_token_hash === currentTokenHash),
    isLegacy: Boolean(row.is_legacy),
  }))
  return {
    devices,
    devicesUsed: devices.length,
    devicesLimit: WEB_DEVICE_LIMIT,
  }
}

export async function revokeDeviceById(input: {
  deviceId: string
  telegramId: number
  reason: 'user_logout' | 'remote_revoke' | 'unlink' | 'replaced'
  db?: Queryable
}): Promise<boolean> {
  const result = await db(input.db).query<{ id: string }>(
    `UPDATE web_telegram_devices
        SET revoked_at = now(),
            revoke_reason = $3
      WHERE id = $1::uuid
        AND telegram_id = $2::bigint
        AND revoked_at IS NULL
      RETURNING id`,
    [input.deviceId, input.telegramId, input.reason]
  )
  return result.rows.length > 0
}

export async function revokeDeviceByTokenHash(input: {
  tokenHash: string
  reason: 'user_logout' | 'remote_revoke' | 'unlink' | 'replaced'
  db?: Queryable
}): Promise<WebTelegramDeviceRow | null> {
  const result = await db(input.db).query<WebTelegramDeviceRow>(
    `UPDATE web_telegram_devices
        SET revoked_at = now(),
            revoke_reason = $2
      WHERE device_token_hash = $1
        AND revoked_at IS NULL
      RETURNING id, telegram_id::text AS telegram_id, web_account_id::text AS web_account_id,
                device_token_hash, display_label, linked_at, last_active_at, idle_expires_at,
                revoked_at, revoke_reason, is_legacy`,
    [input.tokenHash, input.reason]
  )
  return result.rows[0] ?? null
}

export async function revokeAllDevicesForTelegram(
  telegramId: number,
  reason: 'unlink' | 'remote_revoke',
  customDb?: Queryable
): Promise<number> {
  const result = await db(customDb).query<{ id: string }>(
    `UPDATE web_telegram_devices
        SET revoked_at = now(),
            revoke_reason = $2
      WHERE telegram_id = $1::bigint
        AND revoked_at IS NULL
      RETURNING id`,
    [telegramId, reason]
  )
  return result.rows.length
}

export async function rebindWebSessionAccount(input: {
  sessionId: number
  toWebAccountId: string
  db?: Queryable
}): Promise<void> {
  await db(input.db).query(
    `UPDATE web_sessions
        SET web_account_id = $2::uuid
      WHERE id = $1
        AND revoked_at IS NULL
        AND web_account_id IS NOT NULL`,
    [input.sessionId, input.toWebAccountId]
  )
}

export async function getWebAccountEmailState(
  webAccountId: string,
  customDb?: Queryable
): Promise<{ emailNormalized: string | null; emailVerified: boolean }> {
  const result = await db(customDb).query<{
    email_normalized: string | null
    email_verified_at: Date | null
  }>(
    `SELECT email_normalized, email_verified_at
       FROM web_accounts
      WHERE id = $1::uuid`,
    [webAccountId]
  )
  const row = result.rows[0]
  return {
    emailNormalized: row?.email_normalized ?? null,
    emailVerified: Boolean(row?.email_verified_at && row.email_normalized),
  }
}
