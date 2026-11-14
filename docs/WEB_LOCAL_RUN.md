# Локальный запуск GameNight Host WEB

## Требования

- Node 20+ (локально допускается 24.x с предупреждением engines)
- **Локальная** БД `gnh_web_local` (embedded Postgres через Setup; Docker не обязателен)
- Запрещено: `gnh_supabase`, Timeweb `gnh_web_staging`, реальный YooKassa, production secrets

PGlite используется только в unit-тестах сервера. HTTP API требует настоящий Postgres (`pg.Pool`); для E2E Setup поднимает `embedded-postgres` на `127.0.0.1:55432`.

## Быстрый старт E2E

```powershell
# 1) БД + миграции + seed (один раз / при сбросе)
.\deploy\local\Setup-GnhWebLocal.ps1

# 2) Браузер Playwright (если скачивание chromium падает — повторить или GNH_E2E_USE_SYSTEM_CHROME=1)
npm run test:e2e:install

# 3) E2E (сам поднимает API + Vite WEB)
npm run test:e2e
```

Остановка embedded Postgres:

```powershell
.\deploy\local\Setup-GnhWebLocal.ps1 -Stop
```

## Ручной dev

```powershell
.\deploy\local\Setup-GnhWebLocal.ps1
# server/.env.web-local создаётся автоматически (gitignored)

# API с локальным env
cd server
node scripts/run-with-web-local-env.mjs npx tsx watch src/index.ts

# WEB (корень репозитория)
npm run dev:web
```

Откройте `http://localhost:5173/`. Vite proxy → `127.0.0.1:3001`.

## Вход

- Telegram OIDC: кнопка «Войти через Telegram» (нужны `TELEGRAM_OIDC_*`).
- Локальный E2E: `WEB_DEV_LOGIN_ENABLED=1` + кнопка «Локальный вход (dev)» при `VITE_WEB_DEV_LOGIN=1` в gitignored `.env.web.local` (см. пример в docs; Vite mode `web` подхватывает его автоматически), либо:

```bash
curl -i -c cookies.txt -X POST http://localhost:5173/api/web/auth/dev-login \
  -H "Content-Type: application/json" \
  -d "{\"telegramId\":900002,\"secret\":\"local-e2e-dev-secret-not-for-prod\",\"displayName\":\"Test Host\"}"
```

Seed пользователи: `900001` free, `900002` 1m, `900003` lifetime, `900004` expired.

## Платежи

`YOOKASSA_MOCK=1` только в development / local. Create возвращает `mock_*` paymentId; Premium выдаётся после mock webhook, не по одному return_url.

## Сборки

```bash
npm run build        # Mini App → dist/
npm run build:web    # WEB → dist-web/
npm run build --prefix server
```
