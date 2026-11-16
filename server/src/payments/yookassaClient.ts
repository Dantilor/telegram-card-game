/**
 * Authenticated YooKassa API helpers used by webhook/confirm flows.
 * Never trusts unverified webhook body alone for premium grants.
 */

export type YookassaPaymentSnapshot = {
  id: string
  status: string
  amount?: { value?: string; currency?: string }
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

/** Amount in kopecks/rubles as integer rubles from "259.00". */
export function parseYookassaAmountRub(value: string | undefined): number | null {
  if (!value || typeof value !== 'string') return null
  const n = Number.parseFloat(value.replace(',', '.'))
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n)
}
