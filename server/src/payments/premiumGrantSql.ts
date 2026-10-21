/** Claim SQL used by the existing premium grant. One row is claimed once via premium_granted_at. */
export const CLAIM_PREMIUM_GRANT_SQL = `UPDATE payments
     SET premium_granted_at = now()
     WHERE provider_payment_charge_id = $1
       AND premium_granted_at IS NULL
     RETURNING id, status, telegram_id, plan_id, premium_granted_at`

/** Checkout insert. Amount is the tariff price in rubles, the same unit as plans.price_rub. */
export const INSERT_CHECKOUT_PAYMENT_SQL = `INSERT INTO payments (
       telegram_id, plan_id, currency, total_amount, provider_payment_charge_id, status,
       offer_evidence_id, receipt_contact, receipt_contact_kind
     ) VALUES ($1::bigint, $2, 'RUB', $3, $4, 'pending', $5, $6, $7)`

/**
 * Recovery insert when a paid YooKassa id has no local row yet.
 * The partial unique index is payments(provider_payment_charge_id) WHERE provider_payment_charge_id IS NOT NULL.
 */
export const ENSURE_YOOKASSA_PAYMENT_SQL = `INSERT INTO payments (
       telegram_id, plan_id, currency, total_amount, provider_payment_charge_id, status
     ) VALUES ($1::bigint, $2, 'RUB', $3::int, $4, 'pending')
     ON CONFLICT (provider_payment_charge_id) WHERE provider_payment_charge_id IS NOT NULL DO NOTHING`

export const FINALIZE_YOOKASSA_PAYMENT_SQL = `UPDATE payments
     SET status = 'succeeded',
         premium_granted_at = COALESCE(premium_granted_at, now())
     WHERE provider_payment_charge_id = $1`

/**
 * Admin grant writes a marker, not a collected payment.
 * The previous amount column was null; total_amount cannot be null, so the marker stores 0.
 * The granted duration stays on the subscription row.
 */
export const INSERT_ADMIN_GRANT_PAYMENT_SQL = `INSERT INTO payments (
       telegram_id, plan_id, currency, total_amount, provider_payment_charge_id
     ) VALUES ($1::bigint, 'premium', 'RUB', 0, $2)
     ON CONFLICT (provider_payment_charge_id) WHERE provider_payment_charge_id IS NOT NULL DO NOTHING`

/**
 * Stars amount is stored as the integer already supplied by Telegram, without a unit conversion.
 * Idempotency follows payments(telegram_payment_charge_id) WHERE telegram_payment_charge_id IS NOT NULL.
 */
export const INSERT_STARS_PAYMENT_SQL = `INSERT INTO payments (
       telegram_id, plan_id, currency, total_amount, status,
       telegram_payment_charge_id, provider_payment_charge_id
     ) VALUES ($1::bigint, 'premium', $2, $3::int, 'paid', $4, $5)
     ON CONFLICT (telegram_payment_charge_id) WHERE telegram_payment_charge_id IS NOT NULL DO NOTHING
     RETURNING id`
