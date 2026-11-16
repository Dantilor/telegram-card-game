# GNH-WEB-Test - ops before Premium (no LIVE / no Timeweb deploy)

## 1. YooKassa TEST

Local / mock:

```env
YOOKASSA_MOCK=1
YOOKASSA_WEBHOOK_SECRET=local-mock-webhook
YOOKASSA_WEBHOOK_REQUIRE_SECRET=0
```

Staging TEST shop (not LIVE):

```env
YOOKASSA_SHOP_ID=<test_shop_id>
YOOKASSA_SECRET_KEY=<test_secret>
YOOKASSA_RETURN_URL_WEB=https://<staging-web-host>/premium?payment=return
YOOKASSA_RETURN_URL=https://<staging-web-host>/premium?payment=return
YOOKASSA_MOCK=0
# Standard YooKassa HTTP notifications have NO custom Authorization Bearer.
YOOKASSA_WEBHOOK_SECRET=
YOOKASSA_WEBHOOK_REQUIRE_SECRET=0
# Optional: official YooKassa IP ranges (requires TRUST_PROXY=1 on Timeweb).
YOOKASSA_WEBHOOK_IP_CHECK=1
```

In the YooKassa cabinet (TEST shop):

1. Integration -> HTTP notifications
2. URL -> `https://<staging-host>/api/yookassa/webhook`
3. Events: `payment.succeeded`, `payment.canceled`, `refund.succeeded`
4. Do **not** configure a custom Authorization/Bearer - official notifications do not send one
5. Confirm the shop is **TEST**, not live

Code behavior:

- Webhook accepts standard notifications without Bearer
- Premium only after authenticated `GET /v3/payments/{id}` + match paymentId, webAccountId, amount, currency, plan
- Temporary API/DB errors return HTTP 500 so YooKassa retries
- `return_url` / `POST /api/yookassa/confirm` do not grant without API `succeeded`
- WEB grant uses `web_account_id` + `web_payments` (no fake Telegram IDs)
- `refund.succeeded`: partial -> `partially_refunded` (keep entitlement); full -> revoke `web_purchase` for that paymentId only
- Idempotent grants via `premium_granted_at`

## 2. SMTP relay (OTP)

Receipt email (create payment body) != recovery email (bind/recover OTP).

```env
SMTP_ENABLED=1
SMTP_FROM=noreply@your-domain.example
SMTP_RELAY_URL=https://relay.example/v1/send
SMTP_RELAY_TOKEN=<optional_bearer>
```

Checks:

1. `POST /api/web/email/bind/start` -> 8-digit code (non-prod may echo with test transport).
2. `verify` binds email to `web_account_id`.
3. New device / no cookie -> `recover/start` + `recover/complete` issues a new session.
4. Rate-limit / hashed OTP / anti-enumeration on recover remain.

Real relay send on Timeweb is after env is set on the stand (this repo does not deploy).

## 3. Telegram Premium restore plan

**Staging does not use the production bot token or production Telegram DB.**

Safe test path:

1. WEB staging: Profile -> restore from Telegram -> code screen, TTL, copy, auto-poll.
2. Staging Mini App bot (separate token) -> `/link-web` -> enter code.
3. Complete accepts only `telegram_init_data` -> real `telegram_id`.
4. Code is one-shot; reuse / expiry -> error; UI offers a new code.
5. Active `subscriptions` for that telegram_id -> WEB entitlement `telegram_link` + Lifetime/date in UI.
6. E2E/local mock: `WEB_TELEGRAM_LINK_ECHO` + `complete-mock` **non-production only**.

Production linking to live users is a separate agreed release (not this PR).

## 4. Migration 019

See `docs/WEB_STAGING_MIGRATIONS.md` section Migration 019 only.

## 5. Connect TEST shop (Timeweb + YooKassa) - checklist

1. In YooKassa create/open a **TEST** shop; copy shopId + secret key (test keys only).
2. Timeweb GNH-WEB-Test env: set `YOOKASSA_SHOP_ID`, `YOOKASSA_SECRET_KEY`, `YOOKASSA_RETURN_URL_WEB`, `YOOKASSA_MOCK=0`, `YOOKASSA_WEBHOOK_REQUIRE_SECRET=0`, empty `YOOKASSA_WEBHOOK_SECRET`, `TRUST_PROXY=1`, optional `YOOKASSA_WEBHOOK_IP_CHECK=1`.
3. Cabinet webhook URL: `https://dantilor-telegram-card-game-stand-f704.twc1.net/api/yookassa/webhook` (or current staging host).
4. Redeploy/restart the Timeweb app so env is loaded (operator action - not from this agent).
5. Smoke: create WEB order -> pay with YooKassa test card -> webhook -> Premium for that `web_account_id` only.
6. Never paste LIVE shop keys into staging.