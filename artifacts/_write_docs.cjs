const fs = require('fs')

fs.writeFileSync('docs/WEB_SMTP_DNS_SETUP.md', `# WEB SMTP + DNS (SPF / DKIM / DMARC)

Secrets are **never** committed. Configure only in Timeweb / mail provider UI.

## Goal

OTP for email bind + account restore on a new device / after cookie loss.
Sender should eventually be on the public brand domain (e.g. \`noreply@gamenighthost.ru\` or \`noreply@play.gamenighthost.ru\`).

## Application ENV (no values in Git)

| Variable | Required | Notes |
| --- | --- | --- |
| \`SMTP_ENABLED=1\` | yes (prod) | Without this, production throws (no silent test fallback) |
| \`SMTP_FROM\` | yes | Exact From, e.g. \`GameNight Host <noreply@play.gamenighthost.ru>\` |
| \`SMTP_RELAY_URL\` | yes | HTTPS relay endpoint already integrated in \`server/src/services/mailTransport.ts\` |
| \`SMTP_RELAY_TOKEN\` | optional | Bearer for the relay |
| \`SMTP_HOST\` | optional | Present for “configured” detection with FROM |
| \`WEB_EMAIL_OTP_ECHO\` | never in prod | E2E only |

## Relay payload contract

Existing transport POSTs JSON to \`SMTP_RELAY_URL\` with \`to\`, \`from\`, \`subject\`, \`text\` / \`html\`.
OTP body is short, transactional only (no marketing).

## DNS records (install after domain is yours)

Replace \`example.com\` with the chosen apex (\`gamenighthost.ru\`) or the mail domain.

### SPF (TXT on apex or sending subdomain)

\`\`\`
v=spf1 include:<PROVIDER_SPF_INCLUDE> -all
\`\`\`

Use the include string from the chosen provider (Timeweb mail, Unisender Go, Postmark, Amazon SES, etc.). Prefer \`-all\` once sending is verified.

### DKIM

Add the **exact** CNAME/TXT pair issued by the provider (selector + public key). Do not invent selectors.

Example shape (provider-specific):

\`\`\`
<selector>._domainkey.example.com  TXT  "v=DKIM1; k=rsa; p=..."
\`\`\`

or CNAME to provider-managed key host.

### DMARC (TXT on \`_dmarc.example.com\`)

Start monitor-only:

\`\`\`
v=DMARC1; p=none; rua=mailto:dmarc@example.com; fo=1
\`\`\`

After clean reports for 1–2 weeks, tighten to \`p=quarantine\` then \`p=reject\`.

### Alignment tips

- \`SMTP_FROM\` domain must match SPF/DKIM signing domain (or strict alignment parent).
- Prefer subdomain sending (\`mail.play.gamenighthost.ru\`) if apex mail is already used elsewhere.

## Enable checklist

1. Provision relay credentials offline.
2. Set ENV on Timeweb (staging first).
3. Send one OTP from Profile → email bind.
4. Confirm inbox + spam folder.
5. Verify OTP consume is one-time and rate-limited (see \`webEmailOtp.ts\`).
6. Only then point \`SMTP_FROM\` at the public domain and publish DNS.

## Required external data (owner)

- Chosen From address
- Relay URL + token
- Provider SPF include / DKIM records
- DMARC aggregate mailbox
`)

fs.writeFileSync('docs/WEB_DOMAIN_CUTOVER.md', `# Domain cutover — play.gamenighthost.ru

Do **not** buy a domain from CI/agents. Owner confirms availability and ownership.

## Preferred hosts

1. Canonical: \`https://play.gamenighthost.ru\`
2. Optional apex redirect: \`https://gamenighthost.ru\` → play
3. Staging remains on \`*.twc1.net\` until cutover is green

## DNS scheme (Timeweb)

| Host | Type | Value | TTL |
| --- | --- | --- | --- |
| \`play\` | A / CNAME | Timeweb app / proxy target from panel | 300 → 3600 |
| \`@\` (optional) | A / redirect | 301 → \`https://play.gamenighthost.ru\` | 300 |
| \`www\` (optional) | CNAME | \`play.gamenighthost.ru\` or redirect | 300 |

Enable HTTPS certificate in Timeweb for \`play\` (and apex if used).

## App ENV after DNS is live

\`\`\`
WEB_PUBLIC_ORIGIN=https://play.gamenighthost.ru
WEB_COOKIE_SECURE=true
TRUST_PROXY=1
YOOKASSA_RETURN_URL_WEB=https://play.gamenighthost.ru/premium/return
\`\`\`

CORS / cookie notes:

- Cookie: HttpOnly + Secure + SameSite=Lax (existing WEB session)
- Origin must match \`WEB_PUBLIC_ORIGIN\` byte-for-byte (no trailing slash)
- SPA deep links: Timeweb must serve \`index.html\` for all non-API routes

## Transition from twc1.net

1. Keep staging origin working until production origin verified.
2. After cutover, old staging cookies are not valid on the new host (expected).
3. Users restore via email OTP or Telegram link — do not copy session secrets across domains.
4. Update YooKassa return URL + webhook URL to the canonical host.
5. Stop advertising \`*.twc1.net\` in public materials.

## Verification

- \`/\`, \`/games\`, \`/profile\`, \`/play/...\` reload without 404
- Premium return lands on canonical host
- OTP email links (if any) use canonical origin
- Mixed-content / HTTPS only
`)

fs.writeFileSync('docs/WEB_YOOKASSA_LIVE_RUNBOOK.md', `# YooKassa LIVE runbook (WEB Premium)

Staging TEST shop already proved end-to-end. Do **not** put LIVE keys on \`gnh_web_staging\`.

## Plans (no auto-renew)

| Plan | Price | Notes |
| --- | --- | --- |
| 1 month | 259 ₽ | Fixed term |
| 3 months | 399 ₽ | Fixed term |
| Lifetime | 990 ₽ | Permanent WEB entitlement |

## Preconditions

1. Production DB hookup approved (see \`WEB_PRODUCTION_ROLLOUT.md\`)
2. Canonical \`WEB_PUBLIC_ORIGIN\` live
3. Legal offer version active
4. Owner explicit GO for LIVE keys

## Production ENV (names only)

\`\`\`
YOOKASSA_SHOP_ID=<LIVE_SHOP>
YOOKASSA_SECRET_KEY=<LIVE_SECRET>
YOOKASSA_MOCK=0
YOOKASSA_WEBHOOK_REQUIRE_SECRET=0
YOOKASSA_WEBHOOK_IP_CHECK=1
TRUST_PROXY=1
YOOKASSA_RETURN_URL_WEB=https://play.gamenighthost.ru/premium/return
WEB_CHECKOUT_ENABLED=1
\`\`\`

Webhook: official YooKassa HTTP notifications; server verifies payment via API (Bearer optional). Idempotent grant via \`web_payments\` / \`web_entitlements\`.

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
`)

fs.writeFileSync('docs/WEB_PRODUCTION_ROLLOUT.md', `# Production rollout plan (stop before gnh_supabase ops)

Use existing working GameNight Host DB when owner approves. **Do not connect or migrate production from this doc alone.**

## Order (strict)

1. Finish UI on \`feature/gnh-web-standalone\` (done in release sprint)
2. SMTP relay + DNS prepared (\`WEB_SMTP_DNS_SETUP.md\`)
3. Domain cutover prepared (\`WEB_DOMAIN_CUTOVER.md\`)
4. LIVE YooKassa prepared but disabled (\`WEB_YOOKASSA_LIVE_RUNBOOK.md\`)
5. Telegram Premium restore code ready; real user proof **after** shared prod DB
6. **STOP** — obtain explicit owner approval before any \`gnh_supabase\` / prod DB action

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
3. Deploy WEB build with \`WEB_PUBLIC_ORIGIN\`
4. Enable SMTP
5. Smoke: session, OTP, TEST→then LIVE payments
6. Enable Telegram restore complete against real initData
7. Compact acceptance (\`WEB_RELEASE_ACCEPTANCE.md\`)
`)

fs.writeFileSync('docs/WEB_RELEASE_ACCEPTANCE.md', `# Compact release acceptance

Do not re-test already confirmed legal import / staging Premium purchase unless those areas change.

## 1. Desktop (4 themes)

Neon / Light / Sunset / Calm: home hero+portal, picks covers (not strips), catalog, profile, play question card typography.

## 2. iPhone Safari

Launch, play, Premium modal scroll + safe area, email restore UI, reload keeps anon session.

## 3. Android Chrome

Same key paths as iPhone.

## 4. Email

OTP delivery + restore on second device (requires SMTP).

## 5. Payments

Staging TEST purchase already green — re-check only after payment code changes. LIVE only after prod DB + owner GO.

## 6. Telegram restore

UI + API ready; real bind proof after production DB integration.

## Security smoke

- No secrets in Git
- Cookies Secure/HttpOnly on HTTPS origin
- Webhook forgery rejected
- OTP one-time + rate limit
`)

console.log('docs written')
