# Cold-start measurement (Telegram WebView / browser)

Use this when Playwright Chromium is unavailable. Do **not** invent timings.

## In Telegram Mini App (preferred)

1. Open the Mini App once, then fully clear WebView cache / force-stop Telegram / reopen.
2. Append to the Mini App URL query (BotFather Web App URL or debug link): `gnh_perf=1`  
   Or in a one-off console (eruda / remote debug): `localStorage.setItem('gnh_perf','1')` and reload.
3. Wait until Home is visible, then prefer a late snapshot (≥6–10s on a cold VPN start).
4. Remote-debug the WebView (Chrome `chrome://inspect` on Android, Safari Web Inspector on iOS) and run:

```js
copy(JSON.stringify(window.__GNH_PERF__, null, 2))
```

`window.__GNH_PERF__.snapshot` is `early` (~2.5s), `mid` (~6s), `late` (~10s), or `final` (after load / first input). Prefer `late` or `final` for 5–10s cold starts. `uiInteractiveMs` is set only after Home is marked visible **and** the user makes a real pointer/key/touch input (`interactiveSource: "first-input"`).

5. Record separately (from DevTools Network, cache disabled):
   - document TTFB
   - `index-*.js` / `index-*.css` download + transfer size
   - hero image of the active theme only
   - font files that actually appear as network requests (not every `@font-face`)
   - `/api/me`, `/api/plans`, `/api/public-stats`, `/api/legal/me` start/duration (parallel — do not sum)

Useful marks inside `__GNH_PERF__.marks`:
- `firstContentfulPaintMs`, `largestContentfulPaintMs`
- `homeVisibleMs`, `uiInteractiveMs`, `telegramAuthReadyMs`, `reactRootMs`

## Local browser (reproducible, not Telegram)

```bash
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
```

Open `http://127.0.0.1:4173/telegram-card-game/?gnh_perf=1` with DevTools → Network → Disable cache → empty cache and hard reload.

Optional helper (requires `npx playwright install chromium`):

```bash
node scripts/measure-browser-cold.mjs --dir dist --label after
```
