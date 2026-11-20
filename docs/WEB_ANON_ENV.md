# WEB anonymous accounts — environment variables (no secret values)

## Required for local / staging WEB

| Variable | Purpose |
| --- | --- |
| `WEB_FEATURE_ENABLED` / runtime flag | Enable WEB auth routes |
| `WEB_PUBLIC_ORIGIN` | Public site origin for redirects / return URLs |
| `DATABASE_URL` | Must point to `gnh_web_staging` or local — never `gnh_supabase` on staging |
| `YOOKASSA_SHOP_ID` / `YOOKASSA_SECRET_KEY` | TEST shop keys on staging (never LIVE) |
| `YOOKASSA_MOCK` | `0` on Timeweb; `1` only for local mock |
| `YOOKASSA_WEBHOOK_SECRET` | Optional custom Bearer (leave empty for standard YooKassa HTTP notifications) |
| `YOOKASSA_WEBHOOK_REQUIRE_SECRET` | Keep `0` for official cabinet webhooks |
| `YOOKASSA_WEBHOOK_IP_CHECK` | Optional official IP allowlist (`1` on staging with `TRUST_PROXY`) |
| `YOOKASSA_RETURN_URL_WEB` | WEB payment return URL |

## Anonymous session

| Variable | Purpose |
| --- | --- |
| `WEB_ANON_CREATE_MAX_PER_MIN` | Soft rate limit for new anonymous accounts (default 120) |
| Session TTL config | Existing `webSession` / auth config TTL |

## Telegram Premium restore (staging/E2E)

| Variable | Purpose |
| --- | --- |
| `WEB_TELEGRAM_LINK_ECHO=1` | Enable `complete-mock` only (never in production). Authenticated `/telegram-link/start` returns a one-time `deepLink` + `token` (startapp). |
| `TELEGRAM_BOT_USERNAME` | Bot username for deep links (default `GameNightHostBot`). |
| `TELEGRAM_MINI_APP_SHORT_NAME` | Optional BotFather Direct Link short name. Empty → Main Mini App `t.me/bot?startapp=`. |
| `WEB_DEV_LOGIN_SECRET` | Shared secret for `dev-login` and link mock |
| `WEB_DEV_LOGIN_ENABLED` | Local telegramId session bypass (not OIDC) |
| `WEB_OIDC_LOGIN_ENABLED` | Must stay unset/0 — Telegram OIDC is not a WEB login method |

## Auth notes

- Pairing / OTP codes are 8 digits from `crypto.randomInt`.
- Production SMTP requires `SMTP_ENABLED=1`, `SMTP_FROM`, and either direct SMTP (`SMTP_HOST` + user/password) or `SMTP_RELAY_URL` (no silent test fallback). See `WEB_SMTP_DNS_SETUP.md`.

## Email OTP / magic link

| Variable | Purpose |
| --- | --- |
| `WEB_EMAIL_OTP_ECHO=1` | Return token in API JSON for E2E (never production) |
| `SMTP_ENABLED=1` | Enable real mail transport |
| `SMTP_FROM` | From address |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` | Direct SMTP (Timeweb: smtp.timeweb.ru:465) |
| `SMTP_USER` / `SMTP_PASSWORD` | Mailbox credentials |
| `SMTP_TRANSPORT` | Optional `smtp` or `relay` when both are configured |
| `SMTP_RELAY_URL` | HTTPS relay endpoint (legacy; optional if direct SMTP set) |
| `SMTP_RELAY_TOKEN` | Optional bearer for relay |

Default without `SMTP_ENABLED`: test transport (logs only, no marketing).

## Hard bans

- Do not set production Telegram webhook / `gnh_supabase` on WEB staging.
- Do not enable live WEB YooKassa checkout until explicitly approved (`web_checkout_not_enabled` remains).
