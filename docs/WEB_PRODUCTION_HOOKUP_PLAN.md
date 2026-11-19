# Future production hookup (do not execute now)

## Preconditions

1. Legal draft for WEB anonymous accounts / email / Telegram restore approved.
2. Additive migration `017_web_anonymous_accounts.sql` reviewed and applied to the **correct** production DB role path (never ad-hoc GRANT on Timeweb without approval).
3. Staging (`gnh_web_staging`) passes full E2E with mock YooKassa and mock Telegram link.
4. Live WEB YooKassa keys provisioned separately from Telegram Stars flow.
5. SMTP relay ready for OTP (no marketing).

## Safe sequence

1. Apply 017 on a maintenance window to WEB co-host DB only (not `gnh_supabase` unless explicitly decided).
2. Deploy WEB sidecar build with anonymous ensure enabled; keep Telegram Mini App unchanged.
3. Enable mock→live checkout flag only after payment sandbox proof.
4. Enable Telegram restore against production Mini App initData (`/telegram-link/complete`) — **do not** change production Telegram webhook.
5. Monitor: anon create rate, OTP rate limits, webhook idempotency, dual Premium sources.

## Explicit non-goals for first release

- Merge to `main` without review.
- Copy production Premium users into staging.
- Fake `telegram_id` for anonymous WEB users.
- Auto-publish legal texts.
