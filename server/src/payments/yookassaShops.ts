/**
 * Two independent YooKassa shops:
 * - telegram: Mini App checkout (YOOKASSA_SHOP_ID / YOOKASSA_SECRET_KEY), unchanged.
 * - web: play.gamenighthost.ru checkout (YOOKASSA_SHOP_ID_WEB / YOOKASSA_SECRET_KEY_WEB).
 *
 * New WEB payments are created only in the web shop. A WEB order never falls back
 * to the Telegram shop at creation time.
 *
 * Verification of an existing web_payments row asks the web shop first. Only when the
 * web shop answers 404 (object unknown to that shop) is the Telegram shop asked: this
 * covers WEB orders created before the split, when WEB used the Telegram shop. Every
 * answer is an authenticated API response from one of our shops, its recipient must be
 * the shop that answered, and the grant still matches owner, plan and amount in the DB.
 */

import {
  lookupYookassaPayment,
  lookupYookassaRefund,
  type YookassaLookup,
  type YookassaPaymentSnapshot,
  type YookassaRefundSnapshot,
} from './yookassaClient.js'

export type YookassaShop = 'telegram' | 'web'

export type YookassaShopCredentials = {
  shop: YookassaShop
  shopId: string
  secretKey: string
}

type Env = NodeJS.ProcessEnv | Record<string, string | undefined>

export class YookassaShopNotConfiguredError extends Error {
  readonly shop: YookassaShop
  constructor(shop: YookassaShop) {
    super(`yookassa_shop_not_configured:${shop}`)
    this.name = 'YookassaShopNotConfiguredError'
    this.shop = shop
  }
}

export function yookassaShopCredentials(shop: YookassaShop, env: Env = process.env): YookassaShopCredentials | null {
  const shopId = (shop === 'web' ? env.YOOKASSA_SHOP_ID_WEB : env.YOOKASSA_SHOP_ID) ?? ''
  const secretKey = (shop === 'web' ? env.YOOKASSA_SECRET_KEY_WEB : env.YOOKASSA_SECRET_KEY) ?? ''
  if (!shopId.trim() || !secretKey.trim()) return null
  return { shop, shopId: shopId.trim(), secretKey: secretKey.trim() }
}

export function yookassaBasicAuth(credentials: YookassaShopCredentials): string {
  return 'Basic ' + Buffer.from(`${credentials.shopId}:${credentials.secretKey}`).toString('base64')
}

export type VerifiedBy = 'web' | 'telegram_legacy'

type ShopDeps = { env?: Env; fetchImpl?: typeof fetch }

async function askWebThenLegacy<T>(
  lookup: (credentials: YookassaShopCredentials) => Promise<YookassaLookup<T>>,
  accept: (object: T, credentials: YookassaShopCredentials) => boolean,
  env: Env
): Promise<{ object: T; verifiedBy: VerifiedBy } | null> {
  const web = yookassaShopCredentials('web', env)
  if (!web) throw new YookassaShopNotConfiguredError('web')
  const primary = await lookup(web)
  if (primary.status === 'found') {
    return accept(primary.object, web) ? { object: primary.object, verifiedBy: 'web' } : null
  }
  if (primary.status !== 'not_found') return null

  const legacy = yookassaShopCredentials('telegram', env)
  if (!legacy) return null
  const old = await lookup(legacy)
  if (old.status !== 'found') return null
  return accept(old.object, legacy) ? { object: old.object, verifiedBy: 'telegram_legacy' } : null
}

function recipientMatches(recipient: { account_id?: string } | undefined, credentials: YookassaShopCredentials): boolean {
  const accountId = typeof recipient?.account_id === 'string' ? recipient.account_id.trim() : ''
  if (!accountId) return true
  if (accountId === credentials.shopId) return true
  console.error('[YooKassa] payment recipient does not match the shop that answered', { shop: credentials.shop })
  return false
}

/** Verify a payment that already has a web_payments row. */
export async function verifyWebPayment(
  paymentId: string,
  deps: ShopDeps = {}
): Promise<{ payment: YookassaPaymentSnapshot; verifiedBy: VerifiedBy } | null> {
  const found = await askWebThenLegacy<YookassaPaymentSnapshot>(
    (credentials) => lookupYookassaPayment(paymentId, { ...credentials, fetchImpl: deps.fetchImpl }),
    (payment, credentials) => typeof payment.status === 'string' && recipientMatches(payment.recipient, credentials),
    deps.env ?? process.env
  )
  return found ? { payment: found.object, verifiedBy: found.verifiedBy } : null
}

/** Verify a refund whose original payment has a web_payments row. */
export async function verifyWebRefund(
  refundId: string,
  deps: ShopDeps = {}
): Promise<{ refund: YookassaRefundSnapshot; verifiedBy: VerifiedBy } | null> {
  const found = await askWebThenLegacy<YookassaRefundSnapshot>(
    (credentials) => lookupYookassaRefund(refundId, { ...credentials, fetchImpl: deps.fetchImpl }),
    (refund) => typeof refund.status === 'string' && typeof refund.payment_id === 'string',
    deps.env ?? process.env
  )
  return found ? { refund: found.object, verifiedBy: found.verifiedBy } : null
}