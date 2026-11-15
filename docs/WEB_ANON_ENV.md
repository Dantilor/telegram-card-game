# WEB anonymous accounts — environment variables (no secret values)

## Required for local / staging WEB

| Variable | Purpose |
| --- | --- |
| `WEB_FEATURE_ENABLED` / runtime flag | Enable WEB auth routes |
| `WEB_PUBLIC_ORIGIN` | Public site origin for redirects / return URLs |
| `DATABASE_URL` | Must point to `gnh_web_staging` or local — never `gnh_supabase` on staging |
| `YOOKASSA_SHOP_ID` / `YOOKASSA_SECRET_KEY` | Mock placeholders on staging |
| `YOOKASSA_MOCK` / mock mode flag | Enable mock payments (no real charges) |
| `YOOKASSA_WEBHOOK_SECRET` | Bearer for webhook |
| `YOOKASSA_RETURN_URL` or WEB origin | Payment return |

## Anonymous session

| Variable | Purpose |
| --- | --- |
| `WEB_ANON_CREATE_MAX_PER_MIN` | Soft rate limit for new anonymous accounts (default 120) |
| Session TTL config | Existing `webSession` / auth config TTL |

## Telegram Premium restore (staging/E2E)

| Variable | Purpose |
| --- | --- |
| `WEB_TELEGRAM_LINK_ECHO=1` | Enable `complete-mock` only (never in production). Pairing code is always returned to the authenticated WEB session on `/telegram-link/start`. |
| `WEB_DEV_LOGIN_SECRET` | Shared secret for `dev-login` and link mock |
| `WEB_DEV_LOGIN_ENABLED` | Local telegramId session bypass (not OIDC) |
| `WEB_OIDC_LOGIN_ENABLED` | Must stay unset/0 — Telegram OIDC is not a WEB login method |

## Auth notes

- Pairing / OTP codes are 8 digits from `crypto.randomInt`.
- Production SMTP requires `SMTP_ENABLED=1`, `SMTP_FROM`, `SMTP_RELAY_URL` (no silent test fallback).

## Email OTP

| Variable | Purpose |
| --- | --- |
| `WEB_EMAIL_OTP_ECHO=1` | Return OTP in API JSON for E2E (never production) |
| `SMTP_ENABLED=1` | Use relay transport |
| `SMTP_FROM` | From address |
| `SMTP_RELAY_URL` | HTTPS relay endpoint |
| `SMTP_RELAY_TOKEN` | Optional bearer for relay |
| `SMTP_HOST` | Present for “configured” detection with SMTP_FROM |

Default without `SMTP_ENABLED`: test transport (logs only, no marketing).

## Hard bans

- Do not set production Telegram webhook / `gnh_supabase` on WEB staging.
- Do not enable live WEB YooKassa checkout until explicitly approved (`web_checkout_not_enabled` remains).
