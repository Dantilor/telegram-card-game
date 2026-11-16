# WEB SMTP + DNS (SPF / DKIM / DMARC)

Secrets are **never** committed. Configure only in Timeweb / mail provider UI.

## Goal

OTP for email bind + account restore on a new device / after cookie loss.
Sender should eventually be on the public brand domain (e.g. `noreply@gamenighthost.ru` or `noreply@play.gamenighthost.ru`).

## Application ENV (no values in Git)

| Variable | Required | Notes |
| --- | --- | --- |
| `SMTP_ENABLED=1` | yes (prod) | Without this, production throws (no silent test fallback) |
| `SMTP_FROM` | yes | Exact From, e.g. `GameNight Host <noreply@play.gamenighthost.ru>` |
| `SMTP_RELAY_URL` | yes | HTTPS relay endpoint already integrated in `server/src/services/mailTransport.ts` |
| `SMTP_RELAY_TOKEN` | optional | Bearer for the relay |
| `SMTP_HOST` | optional | Present for “configured” detection with FROM |
| `WEB_EMAIL_OTP_ECHO` | never in prod | E2E only |

## Relay payload contract

Existing transport POSTs JSON to `SMTP_RELAY_URL` with `to`, `from`, `subject`, `text` / `html`.
OTP body is short, transactional only (no marketing).

## DNS records (install after domain is yours)

Replace `example.com` with the chosen apex (`gamenighthost.ru`) or the mail domain.

### SPF (TXT on apex or sending subdomain)

```
v=spf1 include:<PROVIDER_SPF_INCLUDE> -all
```

Use the include string from the chosen provider (Timeweb mail, Unisender Go, Postmark, Amazon SES, etc.). Prefer `-all` once sending is verified.

### DKIM

Add the **exact** CNAME/TXT pair issued by the provider (selector + public key). Do not invent selectors.

Example shape (provider-specific):

```
<selector>._domainkey.example.com  TXT  "v=DKIM1; k=rsa; p=..."
```

or CNAME to provider-managed key host.

### DMARC (TXT on `_dmarc.example.com`)

Start monitor-only:

```
v=DMARC1; p=none; rua=mailto:dmarc@example.com; fo=1
```

After clean reports for 1–2 weeks, tighten to `p=quarantine` then `p=reject`.

### Alignment tips

- `SMTP_FROM` domain must match SPF/DKIM signing domain (or strict alignment parent).
- Prefer subdomain sending (`mail.play.gamenighthost.ru`) if apex mail is already used elsewhere.

## Enable checklist

1. Provision relay credentials offline.
2. Set ENV on Timeweb (staging first).
3. Send one OTP from Profile → email bind.
4. Confirm inbox + spam folder.
5. Verify OTP consume is one-time and rate-limited (see `webEmailOtp.ts`).
6. Only then point `SMTP_FROM` at the public domain and publish DNS.

## Required external data (owner)

- Chosen From address
- Relay URL + token
- Provider SPF include / DKIM records
- DMARC aggregate mailbox
