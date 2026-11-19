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

## 6. Миграции и проверки

Только аддитивные:

1. `012_web_sessions.sql`  
2. `013_web_session_profile.sql`  
3. `014_legal_confirmation_source_web.sql`  

**Не** трогают `subscriptions` / `payments` данные.

Скрипт (не автозапуск контейнера):

```bash
cd server
node scripts/apply-production-web-migrations.mjs --dry-run
# после бэкапа и разрешения:
GNH_ALLOW_PROD_WEB_MIGRATE=1 CONFIRM_PRODUCTION_WEB_MIGRATE=YES \
  PRODUCTION_DATABASE_URL='…/gnh_supabase' \
  node scripts/apply-production-web-migrations.mjs
```

Проверки после миграции:

```sql
SELECT to_regclass('public.web_sessions');
SELECT column_name FROM information_schema.columns
  WHERE table_name='web_sessions' AND column_name IN ('display_name','username');
SELECT pg_get_constraintdef(oid) FROM pg_constraint
  WHERE conname='legal_evidence_source_check';
-- Premium sanity
SELECT count(*) FROM subscriptions WHERE active_until > now();
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

1. Backup `gnh_supabase`.  
2. Dry-run миграций → apply 012–014.  
3. BotFather: Login Widget URLs для `WEB-DOMAIN` (webhook без изменений).  
4. Пересобрать Timeweb app с `Dockerfile.production` (WEB flags ещё `0`).  
5. Проверить `GET /api/health`, Mini App login, webhook, `/api/me`.  
6. Привязать `WEB-DOMAIN`.  
7. Выставить OIDC env + `WEB_OWNER_TELEGRAM_IDS` + `GNH_WEB_ENABLED=1` + `GNH_SERVE_WEB_STATIC=1`.  
8. Личный smoke: login, Premium, 1–2 party games, тестовая оплата только если отдельно разрешено.  
9. Снять owner allowlist только когда готовы к публичному WEB.

---

## 10. Связанные файлы

- `Dockerfile.production`  
- `deploy/production/env.production.web.example`  
- `server/scripts/apply-production-web-migrations.mjs`  
- `server/src/config/runtimeFlags.ts` (`GNH_WEB_ENABLED`, `WEB_OWNER_TELEGRAM_IDS`)  
- Staging остаётся отдельным: `Dockerfile.staging` + `GNH_STAGING=1` (не для production).
