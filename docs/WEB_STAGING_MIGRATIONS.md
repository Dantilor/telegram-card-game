# GameNight Host WEB — безопасные миграции `gnh_web_staging`

## Роли (кластер Timeweb общий)

| Роль | Назначение |
|------|------------|
| **Cluster admin** (например `gen_user`) | Предпочтительный исполнитель миграций: подключение **только** к БД `gnh_web_staging`. DDL/владелец объектов staging. |
| **`gnh_web_stage`** | LOGIN приложения стенда. DML + sequences + собственные RLS policies. **Не** migrate-admin. **Не** член `gnh_app`. |
| **`gnh_app`** | Production NOLOGIN-роль кластера. Staging-скрипты её **не создают, не ALTER, не GRANT TO / GRANT membership**. |

Отдельный `gnh_web_migrate` **не обязателен**, если есть admin кластера и вы подключаетесь исключительно к `gnh_web_staging`.

Миграции **не** запускать под `gnh_web_stage`.

`gnh_supabase` не трогать. SQL-скрипты staging **не** делают REVOKE/GRANT/ALTER ROLE в production DB. Ограничение CONNECT для `gnh_web_stage` к другим БД — вручную в панели Timeweb.

## Что изменилось для изоляции

- Вместо production `007_sled_rls.sql` / `011_party_app_grants.sql` — `db/staging/007_sled_rls_staging.sql` и `db/staging/011_party_rls_staging.sql` (без `gnh_app`).
- `00_roles_optional.sql` — только guard, без `CREATE ROLE gnh_app`.
- `01_grants_gnh_web_stage.sql` — table/sequence grants + `party_gnh_web_stage_backend` policies; **нет** `GRANT gnh_app TO gnh_web_stage`.

## TLS

Скрипт `server/scripts/apply-staging-migrations.mjs` использует `resolvePgPoolConfig` (`server/src/dbTls.ts`):

- `rejectUnauthorized: true`
- server name verification
- `sslmode=verify-full` (и `require` / `verify-ca`) допустимы в URL; plaintext / `PGSSLMODE=disable` — отказ
- CA: `DATABASE_TLS_CA_FILE` или `DATABASE_TLS_CA_PEM` (Timeweb root CA)

Пароль и полный URL **не** логируются.

## Команды (Timeweb staging — вручную)

Из каталога `server/` (после `npm run build:api`):

```bash
# 1) Dry-run (без сети)
npm run migrate:staging:dry

# 2) Применить к Timeweb gnh_web_staging от существующего admin
unset DATABASE_URL
export STAGING_DATABASE_URL='postgresql://CLUSTER_ADMIN:PASSWORD@HOST.twc1.net:5432/gnh_web_staging?sslmode=verify-full'
export STAGING_EXPECT_HOST='HOST.twc1.net'
export STAGING_MIGRATE_USER='CLUSTER_ADMIN'
export DATABASE_TLS_CA_FILE='/absolute/path/to/timeweb-ca.crt'
# optional: DATABASE_TLS_SERVERNAME='HOST.twc1.net'  # если host в URL — IP

npm run migrate:staging
# опционально seed:
# npm run migrate:staging:seed
```

Перед grants-шагом роль `gnh_web_stage` должна уже существовать в кластере (Timeweb UI).

App env стенда после миграций:

```bash
DATABASE_URL='postgresql://gnh_web_stage:APP_PASSWORD@HOST.twc1.net:5432/gnh_web_staging?sslmode=verify-full'
DATABASE_TLS_CA_FILE=...
GNH_STAGING=1
GNH_STAGING_DB_NAME=gnh_web_staging
```

## Проверка структуры после миграций

Подключившись **к `gnh_web_staging`** (admin):

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

-- Must be false / empty: no membership in production gnh_app
SELECT pg_has_role('gnh_web_stage', 'gnh_app', 'member');

SELECT polname, polrelid::regclass
  FROM pg_policy
 WHERE polname = 'party_gnh_web_stage_backend';
```

Под `gnh_web_stage` — smoke INSERT/SELECT в `users` / `web_sessions`, затем `ROLLBACK`.

Проверка отсутствия CONNECT к production (ожидаемый отказ; **без** SQL-изменений на `gnh_supabase`):

```bash
# должно FAIL (permission denied / cannot connect)
psql 'postgresql://gnh_web_stage:...@HOST/gnh_supabase?sslmode=verify-full' -c 'SELECT 1'
```

Если CONNECT всё ещё разрешён через PUBLIC — ограничьте в панели Timeweb, не через наши staging SQL на production.

## Права `gnh_web_stage`

Выдаёт `db/staging/01_grants_gnh_web_stage.sql` **только внутри** `gnh_web_staging`:

- `CONNECT` на `gnh_web_staging`, `USAGE` на `public`
- DML на users / subscriptions / payments / events / plans / legal_* / web_* / party tables
- `USAGE, SELECT` на sequences
- RLS policies `party_gnh_web_stage_backend`

Не выдаёт: членство в `gnh_app`, DDL, права на другие БД.

## Блокеры

1. Нет Timeweb root CA → TLS handshake fail.
2. Host в URL — IP без `DATABASE_TLS_SERVERNAME`.
3. Роль `gnh_web_stage` не создана до grants-шага.
4. `gnh_web_stage` уже состоит в `gnh_app` → grants SQL остановится; membership нужно снять admin-ом **вне** `gnh_supabase` (кластерный `ALTER`/`REVOKE`, не наши prod-скрипты).
5. `DATABASE_URL` из production `.env` в shell — скрипт откажется.
6. PUBLIC CONNECT на все БД кластера — ручная настройка Timeweb.
