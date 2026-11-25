/**
 * Pending WEB checkout: the YooKassa payment id we just created, kept only until
 * the buyer is back on /premium and the server has confirmed the payment.
 *
 * Holds no secrets and no personal data: payment id, WEB account id (to notice a
 * lost session) and timestamps. The server still decides ownership on every confirm.
 * sessionStorage is the primary store; a localStorage copy lets a return that opens
 * in another tab (PWA / bank app hand-off) still find the order. Both expire.
 */
const KEY = 'gnh_web_pending_payment'
export const PENDING_PAYMENT_TTL_MS = 2 * 60 * 60 * 1000
const PAYMENT_ID_RE = /^[A-Za-z0-9_-]{8,80}$/

export type PendingWebPayment = {
  paymentId: string
  /** WEB account that created the payment, when known at checkout. */
  accountId: string | null
  createdAt: number
  /** Set when the buyer came back from YooKassa; enables resume after a reload. */
  returnedAt?: number
}

function stores(): Storage[] {
  const out: Storage[] = []
  try {
    out.push(window.sessionStorage)
  } catch {
    /* ignore */
  }
  try {
    out.push(window.localStorage)
  } catch {
    /* ignore */
  }
  return out
}

function parse(raw: string | null, now: number): PendingWebPayment | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw) as Partial<PendingWebPayment>
    if (typeof v.paymentId !== 'string' || !PAYMENT_ID_RE.test(v.paymentId)) return null
    if (typeof v.createdAt !== 'number' || !Number.isFinite(v.createdAt)) return null
    if (now - v.createdAt > PENDING_PAYMENT_TTL_MS || v.createdAt > now + 60_000) return null
    return {
      paymentId: v.paymentId,
      accountId: typeof v.accountId === 'string' && v.accountId ? v.accountId : null,
      createdAt: v.createdAt,
      ...(typeof v.returnedAt === 'number' ? { returnedAt: v.returnedAt } : {}),
    }
  } catch {
    return null
  }
}

function writeAll(rec: PendingWebPayment): void {
  const raw = JSON.stringify(rec)
  for (const s of stores()) {
    try {
      s.setItem(KEY, raw)
    } catch {
      /* ignore */
    }
  }
}

export function savePendingWebPayment(
  paymentId: string,
  accountId: string | null | undefined,
  now = Date.now()
): boolean {
  const id = paymentId.trim()
  if (!PAYMENT_ID_RE.test(id)) return false
  writeAll({ paymentId: id, accountId: accountId ? String(accountId) : null, createdAt: now })
  return true
}

export function readPendingWebPayment(now = Date.now()): PendingWebPayment | null {
  for (const s of stores()) {
    let raw: string | null = null
    try {
      raw = s.getItem(KEY)
    } catch {
      /* ignore */
    }
    const rec = parse(raw, now)
    if (rec) return rec
    if (raw) {
      try {
        s.removeItem(KEY)
      } catch {
        /* ignore */
      }
    }
  }
  return null
}

export function markPendingWebPaymentReturned(now = Date.now()): PendingWebPayment | null {
  const rec = readPendingWebPayment(now)
  if (!rec) return null
  const next = { ...rec, returnedAt: rec.returnedAt ?? now }
  writeAll(next)
  return next
}

export function clearPendingWebPayment(): void {
  for (const s of stores()) {
    try {
      s.removeItem(KEY)
    } catch {
      /* ignore */
    }
  }
}