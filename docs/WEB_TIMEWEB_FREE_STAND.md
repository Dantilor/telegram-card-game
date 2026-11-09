# GameNight Host WEB — бесплатный стенд Timeweb (`gamenight-api`)

## Можно ли запускать WEB при Project directory = `/server`?

**Да**, если Timeweb клонирует весь репозиторий и лишь ставит working directory в `/server` (типичное поведение App Platform). Тогда `../` видит корень monorepo.

Реализация на ветке `feature/gnh-web-standalone`:

- `server/package.json` → `build`: `node scripts/build-web-sidecar.mjs && tsc`
- Sidecar собирает WEB из корня (`npm ci` + `npm run build:web`) и копирует в `server/web-dist`
- Express отдаёт `web-dist` + `/api` с одного origin при `GNH_WEB_ENABLED=1` и `GNH_SERVE_WEB_STATIC=1`

Если Timeweb когда-либо отдаст в контейнер **только** содержимое `/server` без родителя:

- при `GNH_BUILD_WEB=1` сборка **упадёт с явной ошибкой**;
- без флага — API-only (WEB skip).

Минимальная альтернатива тогда: сменить Project directory стенда на корень репо и Dockerfile `Dockerfile.staging` — **только для стенда**, не трогая production app. Сейчас это не требуется.

## Production app не менять

Рабочее приложение остаётся:

| Поле | Значение |
|------|----------|
| Branch | `main` |
| Project directory | `/server` |
| Build | `npm run build` |
| Start | `npm start` |
| Health | `/health` |

Стенд создаётся из **`feature/gnh-web-standalone`** с теми же командами, но другим env.

## Env стенда

Шаблон: `deploy/stand/env.timeweb-stand.example`.

Обязательно:

- `GNH_STAGING=1` → отказ от `gnh_supabase`, bot/broadcasts off
- `DATABASE_URL` → отдельная БД (`gnh_web_staging` или имя в `GNH_STAGING_DB_NAME`)
- `GNH_BUILD_WEB=1`, `GNH_WEB_ENABLED=1`, `GNH_SERVE_WEB_STATIC=1`, `GNH_WEB_STATIC_DIR=web-dist`
- `WEB_PUBLIC_ORIGIN` / `CORS_ORIGIN` = HTTPS URL стенда
- `WEB_OWNER_TELEGRAM_IDS` для закрытого теста
- `WEB_DEV_LOGIN_ENABLED=0`
- OIDC на **тестовом** боте (не ломать production webhook)

Миграции на стенд-БД — вручную (`migrate:staging`), не из start-команды.

## Проверки после поднятия стенда

1. `GET /health` и `GET /api/health`  
2. Открыть `/` → WEB shell  
3. OIDC login только для owner id  
4. `/api/web/session/me` + CSRF cookie  
5. Убедиться, что Telegram webhook path отвечает 200 без обработки (staging)  
6. Mini App production (`main`) не затронут  

## Откат стенда

Остановить/удалить стенд в Timeweb UI. Production app и `gnh_supabase` не затрагиваются.
