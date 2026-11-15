# GNH-WEB-Test — безопасный rollout 017/018 (без автодеплоя)

Ветка: `feature/gnh-web-standalone`  
Запрещено: `gnh_supabase`, production GRANT/REVOKE, Telegram webhook, merge в `main`, самостоятельный deploy.

## 0. Что применяется

| Шаг | Файл | Зачем |
| --- | --- | --- |
| 017 | `server/db/migrations/017_web_anonymous_accounts.sql` | анонимные WEB-аккаунты / entitlements / payments |
| 018 | `server/db/migrations/018_web_rate_buckets.sql` | shared rate-limit для нескольких API-инстансов |
| grants | `server/db/staging/02_grants_017_018_only.sql` | права **только** на новые объекты → `gnh_web_stage` |

**Не** запускать полный пакет `migrate:staging` (001–015), если staging уже поднят.

Скрипт: `npm run migrate:staging:017` (= `server/scripts/apply-staging-017.mjs`).

---

## 1. Порядок (Windows PowerShell)

Подставьте `HOST`, `MIGRATE_PASSWORD`, путь к CA. Миграции выполнять **только** под `gnh_web_migrate` (или DB owner staging), **не** под `gnh_web_stage`.

### 1.1 Backup `gnh_web_staging` (TLS + проверка dump)

```powershell
# С машины, где есть pg_dump и доступ к Timeweb Postgres (TLS).
$env:PGPASSWORD = '<MIGRATE_PASSWORD>'
$env:PGSSLMODE = 'verify-full'
$env:PGSSLROOTCERT = 'C:\path\to\timeweb-ca.crt'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = "C:\backups\gnh_web_staging-$stamp.dump"
New-Item -ItemType Directory -Force -Path (Split-Path $backup) | Out-Null

pg_dump `
  --host=<HOST> --port=5432 `
  --username=gnh_web_migrate `
  --dbname=gnh_web_staging `
  --format=custom --file=$backup

# Непустой файл:
(Get-Item $backup).Length

# Содержимое dump читаемо (список объектов без restore):
pg_restore --list $backup | Select-Object -First 40
# Ожидание: TABLE / INDEX / ACL entries для существующих staging-объектов; exit code 0.
if ($LASTEXITCODE -ne 0) { throw "pg_restore --list failed" }
```

### 1.2 Preflight (без SQL)

```powershell
cd C:\path\to\telegram-card-game\server
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
$env:STAGING_DATABASE_URL = 'postgresql://gnh_web_migrate:<MIGRATE_PASSWORD>@<HOST>:5432/gnh_web_staging?sslmode=verify-full'
$env:STAGING_EXPECT_HOST = '<HOST>'
$env:STAGING_MIGRATE_USER = 'gnh_web_migrate'
$env:DATABASE_TLS_CA_FILE = 'C:\path\to\timeweb-ca.crt'

npm run build:api
npm run migrate:staging:017:dry
npm run migrate:staging:017:preflight
```

Ожидание: `DRY 017`, `DRY 018`, `DRY grants-017-018`, `PREFLIGHT_OK`.  
Отказ при `DATABASE_URL`, `gnh_supabase`, app role, host mismatch, TLS off.

### 1.3 Check connection (read-only)

```powershell
npm run migrate:staging:017:check
```

Покажет `PRESENT`/`MISSING` для новых таблиц (до apply — чаще `MISSING` для 018).

### 1.4 Apply 017+018+grants (только после явного разрешения)

Один `BEGIN`/`COMMIT` на все три шага; при ошибке скрипт делает `ROLLBACK` и exit code ≠ 0.

```powershell
npm run migrate:staging:017
```

### 1.5 Read-only verify

```powershell
npm run verify:staging
```

Должны пройти таблицы `web_accounts`, `web_payments`, `web_rate_buckets`, DML-права `gnh_web_stage` (SELECT/INSERT/UPDATE/DELETE) и `USAGE` на последовательности `web_*_id_seq`.

### 1.6 Rollback / restore (осторожно)

`pg_restore --clean --if-exists` **не гарантирует** полное восстановление прав, RLS-политик и membership без проверки. После любого restore обязателен `npm run verify:staging`.

```powershell
# 1) Остановить GNH-WEB-Test в панели Timeweb (не трогать production Host).
$env:PGPASSWORD = '<MIGRATE_PASSWORD>'
$env:PGSSLMODE = 'verify-full'
$env:PGSSLROOTCERT = 'C:\path\to\timeweb-ca.crt'

# 2) Снова проверить dump перед restore:
pg_restore --list $backup | Select-Object -First 20

# 3) Restore в отдельную временную БД (предпочтительно) ИЛИ в staging после согласования:
#    Создание/удаление БД — только владелец кластера; не выполнять без разрешения.
# pg_restore --host=<HOST> --port=5432 --username=gnh_web_migrate `
#   --dbname=gnh_web_staging --clean --if-exists $backup

# 4) После restore:
#    - сравнить ACL: has_table_privilege / has_sequence_privilege для gnh_web_stage
#    - npm run verify:staging
#    - ручной smoke /api/health
```

Точечный DROP таблиц 017/018 вручную **не рекомендуется** из‑за FK на `web_sessions.web_account_id` и уже выданных GRANT.

---

## 2. Deploy WEB (после миграции, отдельным шагом)

1. В Timeweb **GNH-WEB-Test** выставить env из §3 (ниже).
2. Deploy ветки `feature/gnh-web-standalone` (или согласованный build) **только** на этот стенд.
3. Не деплоить на production Host / не менять webhook `@GameNightHostBot`.
4. Smoke §4.

---

## 3. Timeweb ENV (GNH-WEB-Test)

Сохранить / выставить:

| Variable | Value / правило |
| --- | --- |
| `NODE_ENV` | `production` |
| `GNH_STAGING` | `1` |
| `GNH_EXPECT_DATABASE` | `gnh_web_staging` |
| `GNH_EXPECT_USER` | `gnh_web_stage` |
| `DATABASE_URL` | `…/gnh_web_staging`, user `gnh_web_stage`, `sslmode=verify-full` |
| `DATABASE_TLS_CA_FILE` | путь к Timeweb CA в контейнере |
| `TRUST_PROXY` | `1` |
| `WEB_COOKIE_SECURE` | `true` |
| `WEB_PUBLIC_ORIGIN` | `https://<STAGING-DOMAIN>` |
| `CORS_ORIGIN` | `https://<STAGING-DOMAIN>` (не `*`) |
| `WEB_DEV_LOGIN_ENABLED` | `0` |
| `WEB_OIDC_LOGIN_ENABLED` | `0` |
| `GNH_DISABLE_TELEGRAM_BOT` | `1` |
| `GNH_DISABLE_ADMIN_BROADCAST` | `1` |
| `GNH_SERVE_WEB_STATIC` | `1` |
| `GNH_WEB_STATIC_DIR` | `/app/server/web-dist` |
| `YOOKASSA_*` | **тестовый** магазин; не live |
| `TELEGRAM_BOT_TOKEN` | **staging** бот; не production |
| `SMTP_ENABLED` / `SMTP_FROM` / `SMTP_RELAY_URL` | обязательны при `NODE_ENV=production` |
| `WEB_EMAIL_OTP_ECHO` | **не задавать** |
| `WEB_TELEGRAM_LINK_ECHO` | **не задавать** |

Шаблон: `deploy/staging/env.staging.example`.

---

## 4. Smoke после деплоя

### Можно проверить сразу на staging

- `GET https://<STAGING-DOMAIN>/api/health`
- Открыть `/` → бренд, **нет** «Войти через Telegram»
- DevTools → cookie `gnh_sid` (HttpOnly) + `gnh_csrf`
- Reload → тот же `webAccountId` в `GET /api/web/session/me`
- `/games`, бесплатная игра, `/profile`, `/premium`, `/recover`
- CORS: Origin = staging domain
- iPhone Safari + desktop Chrome

### Частично / с оговорками

| Сценарий | Staging |
| --- | --- |
| WEB Premium mock/test pay | Да, если TEST ЮKassa + webhook на staging |
| Lifetime / продление | Да (серверные `plans` + grant extend) |
| Email OTP | Да при настроенном SMTP relay |
| Cookie loss → `/recover` | Да |
| Telegram restore | Только со **staging Mini App** + initData тестового бота; не production webhook |
| Live ЮKassa / prod Telegram Premium users | **Нет** — отдельная production-интеграция |

---

## 5. Аудит (исправлено перед rollout)

- Premium fetch до cookie → sync после `ensure`
- Telegram-link complete → одна DB-транзакция + `FOR UPDATE`
- IP → `req.ip` (trust proxy), не сырой `X-Forwarded-For`
- OTP/link rate limit → `web_rate_buckets` (018) + fallback memory
- OIDC WEB login → выключен (`WEB_OIDC_LOGIN_ENABLED=0`)
- Нет synthetic `telegram_id` для анонимов

---

## 6. Что не делать

- `npm run migrate:staging` «на всякий случай» на уже живом стенде
- Любые SQL к `gnh_supabase`
- Включать echo-флаги OTP/link на публичном стенде
- Менять production webhook / merge в `main` без отдельного решения
