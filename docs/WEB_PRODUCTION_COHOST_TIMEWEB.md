# GameNight Host WEB — совместный production на существующем Timeweb

**Статус:** подготовка. Деплой / миграции / BotFather / Timeweb UI — только после отдельного разрешения владельца.

Цель: **минимальные расходы**, один API, одна БД `gnh_supabase`, общие Premium, без второго платного backend/БД, если текущий сервис выдержит WEB-статику.

---

## 1. Аудит текущей схемы (по репозиторию)

В репозитории **нет** готового production Dockerfile до этапа WEB (есть `render.yaml` как legacy и `Dockerfile.staging` для изолированного staging).

Фактическая production-форма, выводимая из кода и docs:

| Компонент | Как устроено сейчас |
|-----------|---------------------|
| Backend | Express (`server/`), Node 20, webhook-режим Telegraf (**без** `bot.launch` polling) |
| БД | PostgreSQL `gnh_supabase` (Timeweb managed) |
| Mini App | Vite build `dist/` (часто GitHub Pages / BotFather WebApp URL) → API по `VITE_API_URL` |
| Платежи | ЮKassa create + webhook + API re-verify |
| Admin / рассылки | `/api/admin/*` при `ADMIN_TOKEN` |

**Вывод:** отдельный платный staging/prod контейнер для WEB **не обязателен**, если тот же Timeweb App может:

1. Собрать образ с API + `dist-web`.
2. Отдать WEB-статику с того же процесса (`GNH_SERVE_WEB_STATIC`).
3. Привязать дополнительный HTTPS-домен к **тому же** сервису.

Если Timeweb App Platform **не позволяет** сменить Dockerfile / привязать второй домен к текущему приложению — потребуется **1** дополнительный app (тот же код, тот же `DATABASE_URL`) — это уже платная единица; сначала проверить UI текущего сервиса.

---

## 2. Сколько доп. сервисов нужно

| Вариант | Доп. сервисы | Когда |
|---------|--------------|--------|
| **A (предпочтительный)** | **0** | Текущий Timeweb app принимает новый `Dockerfile.production`, второй домен, те же env + WEB env |
| **B** | **+1 app** | Нельзя менять образ/домен текущего сервиса; новый app смотрит в ту же `gnh_supabase` |
| **C** | **+1 DB** | Не рекомендуется владельцем; только если жёсткая изоляция |

Отдельная БД / staging shop / второй бот для production co-host **не нужны**.

---

## 3. Архитектура Mini App + WEB

```
Telegram Mini App (существующий URL)
        │  initData
        ▼
https://API-OR-WEB-DOMAIN/api/...  ← тот же Express
        ▲
Browser WEB https://WEB-DOMAIN/
        │  cookies session + CSRF, same-origin /api
        └─ static dist-web (если GNH_WEB_ENABLED=1)

PostgreSQL gnh_supabase
  users / subscriptions / payments  — без изменений схемы строк
  + web_sessions / oidc (миграции 012–014)
```

- Premium: один `telegram_id` → одна подписка (Mini App и WEB).
- Бот webhook path **не менять**.
- OIDC Login Widget на **том же** `@GameNightHostBot` (Allowed URLs для WEB-домена; webhook не трогать).

---

## 4. Production Docker

Файл: **`Dockerfile.production`** (корень репо).

Timeweb:

- Context = корень репозитория  
- Dockerfile = `Dockerfile.production`  
- **Не** использовать `Dockerfile.staging` / `GNH_STAGING=1`

Образ кладёт `dist-web` внутрь, но по умолчанию:

- `GNH_WEB_ENABLED=0`
- `GNH_SERVE_WEB_STATIC=0`

то есть поведение как «только API», пока флаг не включён.

Compose для production **не обязателен**.

---

## 5. Что изменить в настройках (без применения сейчас)

1. **Timeweb app** — пересобрать с `Dockerfile.production` (после разрешения).  
2. **Домен** — добавить `WEB-DOMAIN` → тот же сервис.  
3. **Env** — см. `deploy/production/env.production.web.example` (добавить OIDC, `WEB_PUBLIC_ORIGIN`, CORS, owner allowlist).  
4. **BotFather Login Widget** — Allowed origin + redirect на WEB-домен (webhook бота не трогать).  
5. **Миграции 012–014** — вручную после бэкапа (скрипт ниже).  
6. **ЮKassa** — `YOOKASSA_RETURN_URL_WEB`; webhook URL тот же API (уже API-verify).

---

## 6. Миграции и проверки (два этапа)

Скрипт **не** автозапускается из контейнера. По умолчанию / `--through-022` **никогда не применяет 023**.

### Phase A — через 022 + grants (WEB-тарифы ещё inactive)

После деплоя audience-aware API с `GNH_WEB_ENABLED=0` и бэкапа `gnh_supabase`:

```bash
cd server
npm run build:api
npm run migrate:production-web:through-022:dry
npm run migrate:production-web:through-022:preflight

GNH_ALLOW_PROD_WEB_MIGRATE=1 \
CONFIRM_PRODUCTION_WEB_MIGRATE=YES \
CONFIRM_PRODUCTION_BACKUP=YES \
PRODUCTION_DATABASE_URL='postgresql://…/gnh_supabase?sslmode=verify-full' \
DATABASE_TLS_CA_FILE=/path/to/timeweb-ca.crt \
npm run migrate:production-web:through-022
```

Проверки Phase A:

```sql
SELECT column_name FROM information_schema.columns
 WHERE table_name='plans' AND column_name='audience';
SELECT plan_id, price_rub, is_active, audience
  FROM plans
 WHERE plan_id IN (
   'premium_1m','premium_3m','premium_lifetime',
   'premium_web_1m','premium_web_3m','premium_web_lifetime'
 )
 ORDER BY plan_id;
-- Telegram prices must stay 259 / 399 / 990
-- WEB rows must exist with is_active = false
SELECT count(*) FROM subscriptions WHERE active_until > now();
```

Smoke Mini App: тарифы 259 / 399 / 990, оплата Telegram-канала.

### Phase B — только 023 (активация WEB-тарифов)

Только после подтверждения, что новый API фильтрует `/api/plans` по audience:

```bash
cd server
npm run migrate:production-web:activate-023:dry
npm run migrate:production-web:activate-023:preflight

GNH_ALLOW_PROD_WEB_MIGRATE=1 \
CONFIRM_PRODUCTION_WEB_MIGRATE=YES \
CONFIRM_PRODUCTION_BACKUP=YES \
CONFIRM_PRODUCTION_WEB_PLANS_ACTIVATE=YES \
PRODUCTION_DATABASE_URL='postgresql://…/gnh_supabase?sslmode=verify-full' \
DATABASE_TLS_CA_FILE=/path/to/timeweb-ca.crt \
npm run migrate:production-web:activate-023
```

Проверки Phase B:

```sql
SELECT plan_id, price_rub, is_active, audience FROM plans
 WHERE audience = 'web' ORDER BY plan_id;
-- expect active 259 / 499 / 1190
-- GET /api/plans           → только telegram
-- GET /api/plans?audience=web → web rows
```

### Откат API на `ac49d0c` после Phase B

**Сначала** деактивировать WEB-тарифы, **потом** откатывать образ:

```sql
UPDATE plans SET is_active = false WHERE audience = 'web';
```

---

## 7. Резервное копирование и откат

### Backup (перед миграциями / деплоем)

1. Timeweb: snapshot / `pg_dump` только `gnh_supabase`.  
2. Сохранить текущий образ/тег приложения и полный список env.  
3. Зафиксировать BotFather Login Widget URLs (скрин).

### Откат WEB без потери данных

1. Env: `GNH_WEB_ENABLED=0`, `GNH_SERVE_WEB_STATIC=0` → WEB SPA и OIDC start выключены.  
2. Убрать/не рекламировать `WEB-DOMAIN` (или снять домен).  
3. Mini App / webhook / платежи продолжают работать.  
4. Таблицы `web_*` можно оставить (пустыми) — удаление **не** требуется для отката.  
5. При необходимости отката кода — предыдущий образ API без static (если деплой ломает API).

### Откат миграций

Обычно **не** делать `DROP` в production. Если критично — только из бэкапа restore. Скриптов деструктивного down-migration в репо нет намеренно.

---

## 8. Owner-only доступ

```
WEB_OWNER_TELEGRAM_IDS=<ваш_числовой_telegram_id>
GNH_WEB_ENABLED=1
GNH_SERVE_WEB_STATIC=1
```

OIDC callback отклоняет остальных (`owner_only`). Публичного анонса нет. После проверки — очистить allowlist (пустой = открыто для всех Telegram Login).

---

## 9. Пошаговый план запуска (после разрешения)

1. Backup `gnh_supabase` (+ подтвердить ключ к `gnh-delta.enc` если используете).  
2. Deploy API commit с audience-aware `/api/plans`, env: `GNH_WEB_ENABLED=0`, `GNH_SERVE_WEB_STATIC=0`.  
3. Smoke Telegram Mini App (тарифы 259/399/990) **до** любых миграций 022/023.  
4. Phase A: `--through-022` (см. §6). Повторный smoke Mini App.  
5. Phase B: `--activate-023` + `CONFIRM_PRODUCTION_WEB_PLANS_ACTIVATE=YES`.  
6. BotFather: Login Widget URLs для `play.gamenighthost.ru` (webhook без изменений).  
7. Привязать домен + `WEB_PUBLIC_ORIGIN` / `YOOKASSA_RETURN_URL_WEB` / CORS.  
8. Включить `GNH_WEB_ENABLED=1` + `GNH_SERVE_WEB_STATIC=1` (сначала owner allowlist).  
9. Личный smoke WEB: `/premium`, `/wheel`, checkout.  
10. Снять owner allowlist только для публичного WEB.

---

## 10. Связанные файлы

- `Dockerfile.production`  
- `deploy/production/env.production.web.example`  
- `server/scripts/apply-production-web-migrations.mjs`  
- `server/src/config/runtimeFlags.ts` (`GNH_WEB_ENABLED`, `WEB_OWNER_TELEGRAM_IDS`)  
- Staging остаётся отдельным: `Dockerfile.staging` + `GNH_STAGING=1` (не для production).
