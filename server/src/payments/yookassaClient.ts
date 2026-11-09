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
  }
}

export async function fetchYookassaPayment(
  paymentId: string,
  deps: {
    shopId?: string
    secretKey?: string
    fetchImpl?: typeof fetch
  } = {}
): Promise<YookassaPaymentSnapshot | null> {
  const shopId = deps.shopId ?? process.env.YOOKASSA_SHOP_ID ?? ''
  const secretKey = deps.secretKey ?? process.env.YOOKASSA_SECRET_KEY ?? ''
  if (!shopId || !secretKey || !paymentId.trim()) return null

  const fetchImpl = deps.fetchImpl ?? fetch
  const res = await fetchImpl(`https://api.yookassa.ru/v3/payments/${encodeURIComponent(paymentId.trim())}`, {
    method: 'GET',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${shopId}:${secretKey}`).toString('base64'),
      Accept: 'application/json',
    },
  })
  if (!res.ok) return null
  const json = (await res.json()) as YookassaPaymentSnapshot
  if (!json?.id || typeof json.status !== 'string') return null
  return json
}

/** Amount in kopecks/rubles as integer rubles from "259.00". */
export function parseYookassaAmountRub(value: string | undefined): number | null {
  if (!value || typeof value !== 'string') return null
  const n = Number.parseFloat(value.replace(',', '.'))
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n)
}
