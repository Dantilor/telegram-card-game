# Telegram Mini App — production build (Timeweb)

## Why this exists

Mini App client resolves the API only via `VITE_API_URL` and `VITE_API_BASE`
(`src/lib/apiBase.ts` → `resolveApiBase` / `getBaseUrl`).

Setting only `VITE_API_BASE_URL` produces a green Vite build that throws
`api_not_configured` at runtime (regression in static SHA `938fc40`).

Timeweb static hosting for Mini App serves a **prebuilt** git branch
(`timeweb-static` / `prepare/timeweb-static-*`). The platform does **not**
inject Vite env vars when publishing those static files. Env must be correct
**before** the artifact is committed.

## Canonical command

```bash
npm run build:miniapp:production
```

This always:

1. Forces `NODE_ENV=production` for the whole build process tree (overrides a terminal value such as
   `development`; the OS/user environment is never modified)
2. Sets both `VITE_API_URL` and `VITE_API_BASE` to
   `https://dantilor-telegram-card-game-3706.twc1.net`
3. Runs `scripts/check-miniapp-build-env.mjs --require-prod`
4. Runs `tsc -b` and `vite build --mode production --base=/`
5. Runs `scripts/check-miniapp-dist.mjs` (fails if API keys are missing from JS, or if the output is a
   development build: `import.meta.env` `DEV:true`/`PROD:false`, `jsxDEV`, React `*.development.js`,
   JSX `fileName` with local absolute paths)

`MODE:"production"` alone proves nothing: with `NODE_ENV=development` Vite still prints `MODE:"production"`,
but ships dev React (about 2x larger entry bundle). The dist check therefore inspects `DEV`/`PROD` and the JSX runtime.

Do **not** publish a prepare branch after a manual `vite build` with a single
wrong env alias.

## After build → Timeweb prepare branch

1. Copy `dist/*` onto a worktree branched from current `timeweb-static` tip
2. Update `deployment-info.json`
3. Commit & push `prepare/timeweb-static-...`
4. Publish only after explicit approval (fast-forward `timeweb-static`)

## Read-only API smoke

```bash
node scripts/smoke-miniapp-api-readonly.mjs
```

Checks `GET /api/plans` and `GET /api/public-stats` without auth, payments, or DB writes.

## Rollback

Previous known-good static tip before the broken promo publish:
`0efa38ad56ce8c6164ed55931a5b30644287f18f`
(`rollback/timeweb-static-miniapp-before-web-promo-20261127`).
