# Compact release acceptance

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
