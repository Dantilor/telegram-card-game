# GameNight Host WEB — безопасные миграции `gnh_web_staging`

## Роли

| Роль | Назначение |
|------|------------|
| **Migrate / admin** | Отдельная LOGIN-роль **только** для DDL на `gnh_web_staging` (рекомендуемое имя `gnh_web_migrate`) **или** временный cluster admin вроде `gen_user`. Нужны: CONNECT/CREATE на `gnh_web_staging`, права на schema `public`, и `CREATEROLE` (для `gnh_app`) либо заранее созданный `gnh_app`. |
| **`gnh_web_stage`** | LOGIN роль приложения на стенде. SELECT/INSERT/UPDATE/DELETE + sequences. **Не** администратор миграций. |
| **`gnh_app`** | NOLOGIN policy-роль для party RLS (создаётся `00_roles_optional`). |

`gnh_web_migrate` — **имя из нашей конфигурации/локальных тестов**, не создаётся автоматически Timeweb. В панели нужно явно создать migrate-пользователя (или использовать существующего admin) и **не** путать его с `gnh_web_stage`.

Миграции **не** запускать под `gnh_web_stage`.

`gnh_supabase` не трогать. REVOKE на production DB из скриптов **не** выполняется — ограничение CONNECT для `gnh_web_stage` / migrate-роли настраивается вручную в панели Timeweb.

## TLS

Скрипт `server/scripts/apply-staging-migrations.mjs` использует `resolvePgPoolConfig` (`server/src/dbTls.ts`):

- `rejectUnauthorized: true`
- server name verification
- `sslmode=verify-full` (и `require` / `verify-ca`) допустимы в URL; plaintext / `PGSSLMODE=disable` — отказ
- CA: `DATABASE_TLS_CA_FILE` или `DATABASE_TLS_CA_PEM` (Timeweb root CA)

Пароль и полный URL **не** логируются.

## Команды (локально → Timeweb staging)

Из каталога `server/` (после `npm run build:api`):

```bash
# 1) Dry-run (без сети)
npm run migrate:staging:dry

# 2) Применить к Timeweb gnh_web_staging
unset DATABASE_URL
export STAGING_DATABASE_URL='postgresql://MIGRATE_USER:PASSWORD@HOST.twc1.net:5432/gnh_web_staging?sslmode=verify-full'
export STAGING_EXPECT_HOST='HOST.twc1.net'
export STAGING_MIGRATE_USER='MIGRATE_USER'
export DATABASE_TLS_CA_FILE='/absolute/path/to/timeweb-ca.crt'
# optional: DATABASE_TLS_SERVERNAME='HOST.twc1.net'  # обязателен, если host в URL — IP

npm run migrate:staging
# опционально seed:
# npm run migrate:staging:seed
```

App env стенда после миграций:

```bash
DATABASE_URL='postgresql://gnh_web_stage:APP_PASSWORD@HOST.twc1.net:5432/gnh_web_staging?sslmode=verify-full'
DATABASE_TLS_CA_FILE=...   # или DATABASE_TLS_CA_PEM
GNH_STAGING=1
GNH_STAGING_DB_NAME=gnh_web_staging
```

## Проверка структуры после миграций

Подключившись **к `gnh_web_staging`** (migrate user):

```sql
SELECT current_database(); -- gnh_web_staging

SELECT tablename FROM pg_tables
 WHERE schemaname = 'public'
   AND tablename IN (
     'users','subscriptions','payments','web_sessions','web_oidc_states',
     'legal_evidence','sled_rooms','mafia_rooms','doubles_rooms','infected_rooms'
   )
 ORDER BY 1;

SELECT relname, relrowsecurity
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public'
   AND relname IN ('sled_rooms','mafia_rooms','doubles_rooms','infected_rooms');

SELECT has_table_privilege('gnh_web_stage', 'users', 'SELECT') AS users_select,
       has_table_privilege('gnh_web_stage', 'web_sessions', 'INSERT') AS sessions_insert;
```

Под `gnh_web_stage` — smoke INSERT/SELECT в `users` / `web_sessions`, затем откат транзакции.

## Права `gnh_web_stage`

Выдаёт `db/staging/01_grants_gnh_web_stage.sql`:

- `CONNECT` на `gnh_web_staging`, `USAGE` на `public`
- членство в `gnh_app` + отдельные RLS policy на party-таблицах
- DML на users / subscriptions / payments / events / plans / legal_* / web_* / party tables
- `USAGE, SELECT` на существующие sequences

Не выдаёт: создание ролей, доступ к другим БД, DDL.

## Блокеры

1. Нет Timeweb root CA локально → TLS handshake fail.
2. Host в URL — IP без `DATABASE_TLS_SERVERNAME`.
3. Роль `gnh_web_stage` не создана в кластере до grants-шага.
4. Migrate user без `CREATE` на `gnh_web_staging` или без `CREATEROLE` (шаг `00-roles` падает с `permission denied to create role`).
5. Имя `gnh_web_migrate` указано в URL, но роль **не создана** в Timeweb → `password authentication failed` / `Role does not exist` (это не значит, что пароль «почти верный»).
6. `DATABASE_URL` из production `.env` всё ещё в shell — скрипт откажется.
7. По умолчанию `PUBLIC` может иметь `CONNECT` на все БД кластера — ограничьте вручную в Timeweb, без REVOKE из наших SQL на `gnh_supabase`.
