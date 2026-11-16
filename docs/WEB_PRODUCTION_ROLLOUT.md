# Production rollout plan (stop before gnh_supabase ops)

Use existing working GameNight Host DB when owner approves. **Do not connect or migrate production from this doc alone.**

## Order (strict)

1. Finish UI on `feature/gnh-web-standalone` (done in release sprint)
2. SMTP relay + DNS prepared (`WEB_SMTP_DNS_SETUP.md`)
3. Domain cutover prepared (`WEB_DOMAIN_CUTOVER.md`)
4. LIVE YooKassa prepared but disabled (`WEB_YOOKASSA_LIVE_RUNBOOK.md`)
5. Telegram Premium restore code ready; real user proof **after** shared prod DB
6. **STOP** — obtain explicit owner approval before any `gnh_supabase` / prod DB action

## Preflight (read-only)

- Confirm current Timeweb production service topology (do not replace containers blindly)
- List WEB additive migrations not yet on prod (esp. anonymous / web_payments / entitlements / telegram_link)
- Diff table names vs Mini App — no ownership changes, no ad-hoc GRANT/REVOKE/ALTER OWNER
- Backup plan named and restorable
- Dry-run migration against a restore copy if available

## Enable flags

| Flag | Default until GO |
| --- | --- |
| WEB anonymous ensure | staging only |
| LIVE checkout | off |
| SMTP_ENABLED | off until relay ready |
| WEB_TELEGRAM_LINK_ECHO / OTP echo | never on prod |

## Rollback

1. Flip feature flags off (checkout / SMTP / new WEB deploy)
2. Keep Mini App production untouched
3. Restore DB from backup only if a migration was applied and failed — with owner approval
4. DNS can remain on play host serving previous build

## After approval

1. Backup
2. Apply reviewed additive migrations only
3. Deploy WEB build with `WEB_PUBLIC_ORIGIN`
4. Enable SMTP
5. Smoke: session, OTP, TEST→then LIVE payments
6. Enable Telegram restore complete against real initData
7. Compact acceptance (`WEB_RELEASE_ACCEPTANCE.md`)
