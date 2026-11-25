# YooKassa LIVE runbook (WEB Premium, dual shop)

Two independent LIVE shops:

| Channel | Shop | Env |
| --- | --- | --- |
| Telegram Mini App | existing shop (unchanged) | `YOOKASSA_SHOP_ID`, `YOOKASSA_SECRET_KEY`, `YOOKASSA_RETURN_URL` |
| WEB `https://play.gamenighthost.ru` | `1539987` | `YOOKASSA_SHOP_ID_WEB`, `YOOKASSA_SECRET_KEY_WEB`, `YOOKASSA_RETURN_URL_WEB` |

Staging TEST shop already proved end-to-end. Do **not** put LIVE keys on `gnh_web_staging`.

## WEB plans (production catalog, `audience = 'web'`, no auto-renew)

| plan_id | Price | Duration |
| --- | --- | --- |
| `premium_web_1m` | 259 ₽ | 30 days |
| `premium_web_3m` | 499 ₽ | 90 days |
| `premium_web_lifetime` | 1190 ₽ | Lifetime |

Telegram plans (`premium_1m` 259 ₽, `premium_3m` 399 ₽, `premium_lifetime` 990 ₽) are separate and unchanged.
The server always takes the price from the `plans` table; the client never sends an amount.

## Code behaviour

- WEB create (`web_account` session + CSRF) uses **only** the WEB shop. If `YOOKASSA_SHOP_ID_WEB` /
  `YOOKASSA_SECRET_KEY_WEB` are missing, WEB checkout returns `503 payment_not_configured`; it never
  falls back to the Telegram shop.
- Telegram create (Mini App initData) uses only the Telegram shop, exactly as before.
- Webhook / confirm routing is decided by our own DB: a `web_payments` row means a WEB order.
  - WEB order: verified via the WEB shop API. Only if the WEB shop answers 404 is the Telegram shop
    asked (WEB orders created before the split were made in the Telegram shop). Auth errors and 5xx
    never trigger that lookup; they return 500 so YooKassa retries.
  - Anything else: verified via the Telegram shop API, unchanged.
- Premium only after an authenticated `GET /v3/payments/{id}` returns `succeeded` and amount, plan and
  owner match the DB row. `premium_granted_at` makes grants idempotent.
- `refund.succeeded`: refund verified via API; full refund revokes only that WEB purchase, partial keeps it.
- WEB webhooks never write `subscriptions` / `payments`; Telegram webhooks never write `web_payments`.

## Production ENV (names only, add to the existing gamenight-api app)

```
YOOKASSA_SHOP_ID_WEB=1539987
YOOKASSA_SECRET_KEY_WEB=<LIVE secret of shop 1539987, entered by the owner>
YOOKASSA_RETURN_URL_WEB=https://play.gamenighthost.ru/premium?payment=return
```

Must already be present and stay unchanged:

```
YOOKASSA_SHOP_ID=<existing Telegram shop>
YOOKASSA_SECRET_KEY=<existing Telegram secret>
YOOKASSA_MOCK=0
YOOKASSA_WEBHOOK_REQUIRE_SECRET=0
TRUST_PROXY=1
```

Optional: `YOOKASSA_WEBHOOK_IP_CHECK=1` (official YooKassa IP ranges; needs `TRUST_PROXY=1`).

The return URL must use the query form `/premium?payment=return`. There is no `/premium/return` route.

`WEB_CHECKOUT_ENABLED` is **not read by the code** (an old note). Do not rely on it to switch checkout
on or off. To disable WEB checkout, remove `YOOKASSA_SHOP_ID_WEB` / `YOOKASSA_SECRET_KEY_WEB`.

## YooKassa cabinet, shop 1539987

1. Integration -> HTTP notifications
2. URL: `https://play.gamenighthost.ru/api/yookassa/webhook`
3. Events: `payment.succeeded`, `payment.canceled`, `refund.succeeded`
4. No custom Authorization / Bearer
5. The Telegram shop keeps its own notification settings; do not change them.

## Checklist

- [ ] Create WEB payment (offer accepted, receipt email) -> payment appears in shop 1539987
- [ ] Webhook -> paid -> Premium once
- [ ] Reload / new tab keeps Premium
- [ ] Cancel / refund path does not double-grant
- [ ] Forged webhook rejected
- [ ] Telegram Mini App payment still lands in the Telegram shop

## Hard bans

- No LIVE on staging DB
- No new mock payment paths
- No production deploy without owner GO