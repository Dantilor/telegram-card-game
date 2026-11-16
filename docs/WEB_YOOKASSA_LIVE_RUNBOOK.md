# YooKassa LIVE runbook (WEB Premium)

Staging TEST shop already proved end-to-end. Do **not** put LIVE keys on `gnh_web_staging`.

## Plans (no auto-renew)

| Plan | Price | Notes |
| --- | --- | --- |
| 1 month | 259 ₽ | Fixed term |
| 3 months | 399 ₽ | Fixed term |
| Lifetime | 990 ₽ | Permanent WEB entitlement |

## Preconditions

1. Production DB hookup approved (see `WEB_PRODUCTION_ROLLOUT.md`)
2. Canonical `WEB_PUBLIC_ORIGIN` live
3. Legal offer version active
4. Owner explicit GO for LIVE keys

## Production ENV (names only)

```
YOOKASSA_SHOP_ID=<LIVE_SHOP>
YOOKASSA_SECRET_KEY=<LIVE_SECRET>
YOOKASSA_MOCK=0
YOOKASSA_WEBHOOK_REQUIRE_SECRET=0
YOOKASSA_WEBHOOK_IP_CHECK=1
TRUST_PROXY=1
YOOKASSA_RETURN_URL_WEB=https://play.gamenighthost.ru/premium/return
WEB_CHECKOUT_ENABLED=1
```

Webhook: official YooKassa HTTP notifications; server verifies payment via API (Bearer optional). Idempotent grant via `web_payments` / `web_entitlements`.

## Checklist

- [ ] Create payment (offer accepted, receipt email)
- [ ] Webhook → paid → Premium once
- [ ] Reload / new tab keeps Premium
- [ ] Cancel / refund path does not double-grant
- [ ] Forged webhook rejected
- [ ] Telegram Stars flow untouched

## Hard bans

- No LIVE on staging DB
- No new mock payment paths
- No production deploy without owner GO
