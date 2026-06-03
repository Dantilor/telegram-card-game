/**
 * Нормализует Telegram ID из PostgreSQL bigint, YooKassa metadata или JSON body.
 * Возвращает строку цифр, например "434230321", или null.
 */
export function normalizeTelegramId(value: unknown): string | null {
  if (value === null || value === undefined) return null

  if (typeof value === 'bigint') {
    const s = value.toString()
    return /^\d+$/.test(s) ? s : null
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) return null
    return String(value)
  }

  const s = String(value).trim()
  if (!s || !/^\d+$/.test(s)) return null
  return s
}

export function resolveTelegramIdForGrant(sources: {
  rowTelegramId?: unknown
  metaTelegramId?: unknown
  metaTelegramIdAlt?: unknown
  bodyTelegramId?: unknown
}): string | null {
  return (
    normalizeTelegramId(sources.rowTelegramId) ??
    normalizeTelegramId(sources.bodyTelegramId) ??
    normalizeTelegramId(sources.metaTelegramId) ??
    normalizeTelegramId(sources.metaTelegramIdAlt) ??
    null
  )
}

export function resolvePlanIdForGrant(sources: {
  rowPlanId?: unknown
  metaPlanId?: unknown
  metaPlanIdAlt?: unknown
}): string | null {
  const fromRow = normalizePlanId(sources.rowPlanId)
  if (fromRow) return fromRow
  const fromMeta = normalizePlanId(sources.metaPlanId)
  if (fromMeta) return fromMeta
  return normalizePlanId(sources.metaPlanIdAlt)
}

function normalizePlanId(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const s = String(value).trim()
  return s || null
}
