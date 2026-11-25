# Domain cutover — play.gamenighthost.ru

Do **not** buy a domain from CI/agents. Owner confirms availability and ownership.

## Preferred hosts

1. Canonical: `https://play.gamenighthost.ru`
2. Optional apex redirect: `https://gamenighthost.ru` → play
3. Staging remains on `*.twc1.net` until cutover is green

## DNS scheme (Timeweb)

| Host | Type | Value | TTL |
| --- | --- | --- | --- |
| `play` | A / CNAME | Timeweb app / proxy target from panel | 300 → 3600 |
| `@` (optional) | A / redirect | 301 → `https://play.gamenighthost.ru` | 300 |
| `www` (optional) | CNAME | `play.gamenighthost.ru` or redirect | 300 |

Enable HTTPS certificate in Timeweb for `play` (and apex if used).

## App ENV after DNS is live

```
WEB_PUBLIC_ORIGIN=https://play.gamenighthost.ru
WEB_COOKIE_SECURE=true
TRUST_PROXY=1
YOOKASSA_RETURN_URL_WEB=https://play.gamenighthost.ru/premium?payment=return
```

CORS / cookie notes:

- Cookie: HttpOnly + Secure + SameSite=Lax (existing WEB session)
- Origin must match `WEB_PUBLIC_ORIGIN` byte-for-byte (no trailing slash)
- SPA deep links: Timeweb must serve `index.html` for all non-API routes

## Transition from twc1.net

1. Keep staging origin working until production origin verified.
2. After cutover, old staging cookies are not valid on the new host (expected).
3. Users restore via email OTP or Telegram link — do not copy session secrets across domains.
4. Update YooKassa return URL + webhook URL to the canonical host.
5. Stop advertising `*.twc1.net` in public materials.

## Verification

- `/`, `/games`, `/profile`, `/play/...` reload without 404
- Premium return lands on canonical host
- OTP email links (if any) use canonical origin
- Mixed-content / HTTPS only
