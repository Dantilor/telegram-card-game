/**
 * Authenticated YooKassa API helpers used by webhook/confirm flows.
 * Never trusts unverified webhook body alone for premium grants.
 */

export type YookassaPaymentSnapshot = {
  id: string
  status: string
  amount?: { value?: string; currency?: string }
  recipient?: { account_id?: string }
  metadata?: {
    telegram_id?: string
    plan_id?: string
    telegramId?: string
    planId?: string
    userId?: string
    web_account_id?: string
  }
}

async function yookassaAuthHeader(deps: { shopId?: string; secretKey?: string }): Promise<string | null> {
  const shopId = deps.shopId ?? process.env.YOOKASSA_SHOP_ID ?? ''
  const secretKey = deps.secretKey ?? process.env.YOOKASSA_SECRET_KEY ?? ''
  if (!shopId || !secretKey) return null
  return 'Basic ' + Buffer.from(`${shopId}:${secretKey}`).toString('base64')
}

export async function fetchYookassaPayment(
  paymentId: string,
  deps: {
    shopId?: string
    secretKey?: string
    fetchImpl?: typeof fetch
  } = {}
): Promise<YookassaPaymentSnapshot | null> {
  const auth = await yookassaAuthHeader(deps)
  if (!auth || !paymentId.trim()) return null

  const fetchImpl = deps.fetchImpl ?? fetch
  const res = await fetchImpl(`https://api.yookassa.ru/v3/payments/${encodeURIComponent(paymentId.trim())}`, {
    method: 'GET',
    headers: {
      Authorization: auth,
      Accept: 'application/json',
    },
  })
  // Transient provider failures must bubble so webhook returns 5xx and YooKassa retries.
  if (res.status >= 500) {
    throw new Error(`yookassa_payment_lookup_${res.status}`)
  }
  if (!res.ok) return null
  const json = (await res.json()) as YookassaPaymentSnapshot
  if (!json?.id || typeof json.status !== 'string') return null
  return json
}

export type YookassaRefundSnapshot = {
  id: string
  status: string
  payment_id: string
  amount?: { value?: string; currency?: string }
}

/** Authenticated refund lookup — never trust webhook body alone for revoke. */
export async function fetchYookassaRefund(
  refundId: string,
  deps: {
    shopId?: string
    secretKey?: string
    fetchImpl?: typeof fetch
  } = {}
): Promise<YookassaRefundSnapshot | null> {
  const auth = await yookassaAuthHeader(deps)
  if (!auth || !refundId.trim()) return null

  const fetchImpl = deps.fetchImpl ?? fetch
  const res = await fetchImpl(`https://api.yookassa.ru/v3/refunds/${encodeURIComponent(refundId.trim())}`, {
    method: 'GET',
    headers: {
      Authorization: auth,
      Accept: 'application/json',
    },
  })
  // Transient provider/network failures must bubble so webhook returns 5xx and YooKassa retries.
  if (res.status >= 500) {
    throw new Error(`yookassa_refund_lookup_${res.status}`)
  }
  if (!res.ok) return null
  const json = (await res.json()) as YookassaRefundSnapshot
  if (!json?.id || typeof json.status !== 'string' || typeof json.payment_id !== 'string') return null
  return json
}

export type YookassaLookup<T> =
  | { status: 'found'; object: T }
  | { status: 'not_found' }
  | { status: 'rejected'; httpStatus: number }

/**
 * Lookup that distinguishes "this shop does not know the object" (404) from
 * credential problems. 401/403 and 5xx throw so webhooks return 5xx and retry.
 */
async function lookupYookassaObject<T extends { id?: unknown }>(
  kind: 'payments' | 'refunds',
  objectId: string,
  deps: { shopId: string; secretKey: string; fetchImpl?: typeof fetch }
): Promise<YookassaLookup<T>> {
  const id = objectId.trim()
  if (!deps.shopId || !deps.secretKey) throw new Error(`yookassa_${kind}_lookup_not_configured`)
  if (!id) return { status: 'rejected', httpStatus: 400 }
  const fetchImpl = deps.fetchImpl ?? fetch
  const res = await fetchImpl(`https://api.yookassa.ru/v3/${kind}/${encodeURIComponent(id)}`, {
    method: 'GET',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${deps.shopId}:${deps.secretKey}`).toString('base64'),
      Accept: 'application/json',
    },
  })
  if (res.status >= 500) throw new Error(`yookassa_${kind}_lookup_${res.status}`)
  if (res.status === 401 || res.status === 403) throw new Error(`yookassa_${kind}_lookup_auth_${res.status}`)
  if (res.status === 404) return { status: 'not_found' }
  if (!res.ok) return { status: 'rejected', httpStatus: res.status }
  const json = (await res.json()) as T
  if (!json || json.id !== id) return { status: 'rejected', httpStatus: res.status }
  return { status: 'found', object: json }
}

export function lookupYookassaPayment(
  paymentId: string,
  deps: { shopId: string; secretKey: string; fetchImpl?: typeof fetch }
): Promise<YookassaLookup<YookassaPaymentSnapshot>> {
  return lookupYookassaObject<YookassaPaymentSnapshot>('payments', paymentId, deps)
}

export function lookupYookassaRefund(
  refundId: string,
  deps: { shopId: string; secretKey: string; fetchImpl?: typeof fetch }
): Promise<YookassaLookup<YookassaRefundSnapshot>> {
  return lookupYookassaObject<YookassaRefundSnapshot>('refunds', refundId, deps)
}

/** Amount in kopecks/rubles as integer rubles from "259.00". */
export function parseYookassaAmountRub(value: string | undefined): number | null {
  if (!value || typeof value !== 'string') return null
  const n = Number.parseFloat(value.replace(',', '.'))
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n)
}
