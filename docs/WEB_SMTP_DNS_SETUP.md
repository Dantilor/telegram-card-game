# WEB SMTP + DNS (SPF / DKIM / DMARC)

Secrets are **never** committed. Configure only in Timeweb / mail provider UI.

## Goal

Magic-link mail for WEB email bind, Premium recovery, and post-purchase confirmation.
Sender: `noreply@gamenighthost.ru` via Timeweb SMTP (or legacy HTTP relay).

Magic-link URLs use `WEB_PUBLIC_ORIGIN` (production: `https://play.gamenighthost.ru`).

## Application ENV (no values in Git)

### Direct SMTP (Timeweb mailbox) — preferred for production WEB

| Variable | Required | Notes |
| --- | --- | --- |
| `SMTP_ENABLED=1` | yes (prod) | Without this, production throws (no silent test fallback) |
| `SMTP_FROM` | yes | Exact From, e.g. `GameNight Host <noreply@gamenighthost.ru>` |
| `SMTP_HOST` | yes | `smtp.timeweb.ru` |
| `SMTP_PORT` | yes | `465` |
| `SMTP_SECURE` | yes | `true` (TLS from connect) |
| `SMTP_USER` | yes | `noreply@gamenighthost.ru` |
| `SMTP_PASSWORD` | yes | Mailbox password from Timeweb only |
| `SMTP_TRANSPORT` | optional | `smtp` \| `relay` — required if both direct SMTP and relay are configured |
| `WEB_EMAIL_OTP_ECHO` | never in prod | E2E only |

TLS certificate verification is always on (`rejectUnauthorized: true`). Do not disable it.

`SMTP_RELAY_URL` is **not** required when direct SMTP is configured.

### Legacy HTTP relay (still supported)

| Variable | Required | Notes |
| --- | --- | --- |
| `SMTP_RELAY_URL` | yes for relay mode | HTTPS relay endpoint |
| `SMTP_RELAY_TOKEN` | optional | Bearer for the relay |

If both direct SMTP credentials and `SMTP_RELAY_URL` are set, the server refuses to guess: set `SMTP_TRANSPORT=smtp` or `SMTP_TRANSPORT=relay`.

## Conflict / mode selection

1. `SMTP_TRANSPORT=smtp` → Nodemailer direct SMTP only  
2. `SMTP_TRANSPORT=relay` → HTTP relay only  
3. unset (`auto`):
   - direct SMTP complete → `smtp`
   - else relay URL → `smtp_relay`
   - both complete → **error** (set `SMTP_TRANSPORT`)
   - neither → production throws; non-prod may use test transport

## Owner CLI (no auto-send on boot)

From `server/` after deploy (ENV already loaded by the host, or export locally):

```bash
npm run smtp:check
npm run smtp:send-test -- --to owner@example.com
```

`smtp:check` prints configuration status without secrets.  
`smtp:send-test` sends **one** message only when `--to` is explicit.

## Relay payload contract

Relay transport POSTs JSON to `SMTP_RELAY_URL` with `to`, `from`, `subject`, `text` / `html`.
Bodies are short, transactional only (no marketing).

## Post-deploy delivery checklist

1. Set SMTP_* ENV on Timeweb (do not commit passwords).
2. Redeploy / restart API so ENV is loaded (`ae72a88` lineage + this SMTP commit).
3. On the app host: `npm run smtp:check` → `ok: true`, `mode: "smtp"`.
4. `npm run smtp:send-test -- --to <owner inbox>`.
5. Confirm inbox + spam; From must be `GameNight Host <noreply@gamenighthost.ru>`.
6. With WEB flags still off, optional: after enabling WEB later, Profile → bind email and open `https://play.gamenighthost.ru/email/confirm?...`.
7. Confirm link is one-time, 30 minutes, rate-limited (`webEmailOtp.ts`).

Mail send failures return API errors (`mail_smtp_*` / `mail_relay_*`) — they are **not** treated as successful email confirmation.

## DNS records (install after domain is yours)

Replace `example.com` with the apex (`gamenighthost.ru`) or the mail domain.

### SPF (TXT on apex or sending subdomain)

```
v=spf1 include:spf.timeweb.ru ~all
```

Use the exact include string from Timeweb mail docs once verified; tighten to `-all` after clean delivery.

### DKIM

Add the **exact** CNAME/TXT pair issued by Timeweb (selector + public key). Do not invent selectors.

### DMARC (TXT on `_dmarc.gamenighthost.ru`)

Start monitor-only:

```
v=DMARC1; p=none; rua=mailto:dmarc@gamenighthost.ru; fo=1
```

After clean reports for 1–2 weeks, tighten to `p=quarantine` then `p=reject`.

### Alignment tips

- `SMTP_FROM` domain must match SPF/DKIM signing domain (or strict alignment parent).
- Prefer mailbox on the same apex that signs mail (`noreply@gamenighthost.ru`).

## Enable checklist

1. Provision mailbox `noreply@gamenighthost.ru` in Timeweb.
2. Set ENV on Timeweb (password only in protected env).
3. Run `smtp:check` + one `smtp:send-test`.
4. Confirm inbox + spam folder.
5. Only then rely on WEB bind / recover / post-purchase magic links.
6. Keep WEB feature flags off until the separate WEB launch gate.

## Required external data (owner)

- From address (`GameNight Host <noreply@gamenighthost.ru>`)
- SMTP password (Timeweb env only)
- Optional: relay URL + token if not using direct SMTP
- Provider SPF include / DKIM records
- DMARC aggregate mailbox
