# GameNight Host — Яндекс Метрика + Яндекс Директ (draft, no production changes)

Baseline: be57d85aae2e6054d308d6711d6eac81b7e6426a. This branch does not change Telegram, YooKassa, DB schema or production.

## Feature flag and privacy
- Vite WEB-only `VITE_GNH_METRIKA_ENABLED=1`, **default off**.
- This branch restores an earlier Metrika implementation from `feature/gnh-web-metrika-20261124`.
- Counter: **114652319**. Build MUST NOT deploy with flag on before the newly approved privacy policy and a specific consent notice about **Yandex Metrika** are published in production API legal documents. VK pixel, if later introduced, requires its own documented consent and ID.
- No tag.js script, Yandex cookies or network requests before fresh opt-in (v2 key). Reject keeps site usable. Revoke stops new script activity.
- Webvisor, clickmap, trackLinks, ecommerce form recording disabled; do not transfer email/phone/Telegram ID/payment IDs/code/token via goals or URLs.
- SPA hit uses scrubbed paths and strips query strings. Review sensitive paths with QA before release.
- Existing first-party event gate stays separate.
- Do NOT reuse existing tests' localStorage legacy v1 flag as fresh permission.

## Goal identifiers (create manually in Metrika UI)
- `game_open` — opening the game page
- `game_start` — starting a round
- `premium_view` — viewing Premium
- `premium_payment_start` — starting YooKassa payment
- `premium_purchase` — **do not enable yet**: confirmation needs server-proven NEW entitlement, not a client status flip
- Optional: `account_login`, `premium_checkout` only after implementing verified event semantics.

## Yandex Direct
- Reuse the existing campaign dated 24 November 2026; do not create a new one.
- Counter will appear on campaign > Цели only after deployed code is discoverable and the campaign owner can access the Metrika counter.
- Link primary conversion target first after it is actually measured; avoid optimizing for pageview when seeking sales.
- Existing ad campaign payment requested ~2,925 RUB; user must initiate payment manually, after QA.
- The platform may submit automatically to moderation / start ads after funding.

## Verification to run BEFORE production
1. Unit, typecheck, build:web, build for Mini App, Playwright.
2. WEB no consent: no mc.yandex.ru, no tag.js, no _ym cookies; no UI blocking.
3. WEB consent: exactly one script, correct SPA hits and goals.
4. Withdrawal in profile: no further tracking; refresh and test again.
5. No checkout price/token/email in hit URL or goal payload; no purchase goal on email restore, page reload or payment pending.
6. Mini App untouched: never sees Metrika script or banner.
7. Mobile 360/390 px layouts and PWA.
8. Production deploy only with explicit owner approval and updated legal policy. 
