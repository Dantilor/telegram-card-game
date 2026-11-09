# GameNight Host WEB — STAGING на Timeweb Cloud

**Статус:** staging-ready конфигурация. Фактическую публикацию выполнять только после отдельного разрешения.

Цель: отдельный HTTPS-origin для WEB + API на тестовой PostgreSQL, без касания production (`gnh_supabase`, рабочий бот, live ЮKassa).

---

## 1. Что создать в Timeweb

1. **Отдельное Cloud Apps / Docker-приложение** (или контейнер) для staging — не редактировать работающий production-сервис GNH.
2. **Отдельную PostgreSQL-базу** с именем вроде `gnh_web_staging` (не `gnh_supabase`).
3. **HTTPS-домен** (поддомен), например `staging.example.com`, с сертификатом Timeweb / Let’s Encrypt.
4. Секреты staging только в env панели Timeweb (не в git).

Артефакты в репозитории:

| Путь | Назначение |
|------|------------|
| `deploy/staging/Dockerfile` | Сборка `dist-web` + Express API |
| `deploy/staging/docker-compose.yml` | Локальный/ручной подъём staging |
| `deploy/staging/nginx.conf` | Опциональный edge proxy + SPA |
| `deploy/staging/env.staging.example` | Шаблон переменных |
| `server/scripts/apply-staging-migrations.mjs` | Миграции 001–014 + seed |
| `server/db/staging/*` | Фикс тарифов, роли, seed |

---

## 2. Нужен ли дополнительный контейнер?

**Рекомендация:** один staging-контейнер из `deploy/staging/Dockerfile`.

Он:

- собирает WEB (`npm run build:web` → `dist-web`);
- собирает API (`server`);
- при `GNH_SERVE_WEB_STATIC=1` отдаёт статику и SPA fallback с того же origin, что и `/api`.

Альтернатива (два процесса): nginx (`deploy/staging/nginx.conf`) + API без static — если Timeweb удобнее разделить static/edge и Node.

Production-контейнер **не трогать**.

---

## 3. PostgreSQL: новая база или новый кластер?

Достаточно **отдельной базы** в существующем managed PostgreSQL Timeweb, если:

- пользователь/пароль staging не совпадает с production app role, либо права ограничены только `gnh_web_staging`;
- в `DATABASE_URL` указан путь `/gnh_web_staging`, не `/gnh_supabase`.

Отдельный кластер нужен только если политика изоляции требует полного сетевого разделения — это дороже и не обязательно для 3A.

При старте с `GNH_STAGING=1` API **откажется запускаться**, если в URL есть `gnh_supabase`.

---

## 4. HTTPS-домен

1. В Timeweb привяжите домен к staging-приложению.
2. Включите HTTPS.
3. Убедитесь, что снаружи открывается один origin:
   - `https://STAGING-DOMAIN/` — WEB
   - `https://STAGING-DOMAIN/api/health` — health JSON
4. Express: `TRUST_PROXY=1`, `WEB_COOKIE_SECURE=true`, `WEB_PUBLIC_ORIGIN=https://STAGING-DOMAIN`.

Проверка cookie: после OIDC login `Set-Cookie` содержит `Secure` и `HttpOnly` для `gnh_sid`, `SameSite=Lax`.

---

## 5. Переменные окружения

Скопируйте `deploy/staging/env.staging.example` → `deploy/staging/.env.staging` (локально) или заполните панель Timeweb.

Обязательные:

- `DATABASE_URL` → только staging DB  
- `TELEGRAM_BOT_TOKEN` → **тестовый** бот  
- `TELEGRAM_OIDC_CLIENT_ID` / `TELEGRAM_OIDC_CLIENT_SECRET`  
- `TELEGRAM_OIDC_REDIRECT_URI=https://STAGING-DOMAIN/api/web/auth/telegram/callback`  
- `WEB_PUBLIC_ORIGIN=https://STAGING-DOMAIN`  
- `CORS_ORIGIN=https://STAGING-DOMAIN` (не `*`)  
- `YOOKASSA_SHOP_ID` / `YOOKASSA_SECRET_KEY` → **тестовый** магазин  
- `YOOKASSA_RETURN_URL_WEB=https://STAGING-DOMAIN/premium?payment=return`  
- `YOOKASSA_WEBHOOK_REQUIRE_SECRET=0`  
- `WEB_DEV_LOGIN_ENABLED=0`  
- `GNH_STAGING=1`  
- `GNH_DISABLE_TELEGRAM_BOT=1`  
- `ADMIN_TOKEN` — случайный staging-only  

Не копировать: production `DATABASE_URL`, live ЮKassa, токен `@GameNightHostBot`, production `ADMIN_TOKEN`.

---

## 6. Тестовый Telegram-бот для OIDC

1. В [@BotFather](https://t.me/BotFather) создайте **нового** бота, например `@GNHWebStagingBot`.
2. **Не** меняйте Login Widget / webhook у `@GameNightHostBot`.
3. Для staging-бота: `/setdomain` / Login Widget → Allowed URLs (см. §7).
4. Сохраните bot token и OIDC Client ID/Secret только в env staging.
5. Scopes: `openid profile` (без phone / `telegram:bot_access`).

Сервер берёт Telegram ID только из проверенного `id_token` (JWKS), не из body.

---

## 7. BotFather Allowed URLs

Для **staging-бота**:

- Origin: `https://STAGING-DOMAIN`
- Redirect: `https://STAGING-DOMAIN/api/web/auth/telegram/callback`

Должно совпадать с `TELEGRAM_OIDC_REDIRECT_URI` и `WEB_PUBLIC_ORIGIN` побайтно (схема, хост, без лишнего слэша в origin).

Production Login Widget URLs **не изменять**.

---

## 8. Тестовая ЮKassa

1. В личном кабинете ЮKassa создайте / используйте **тестовый** магазин.
2. Укажите webhook URL: `https://STAGING-DOMAIN/api/yookassa/webhook`.
3. В env staging — test `SHOP_ID` / `SECRET_KEY`.
4. Важно: у ЮKassa **нет** универсального HMAC secret в каждом уведомлении.  
   `YOOKASSA_WEBHOOK_SECRET` — опциональный custom `Authorization`, если вы сами его настроите на стороне прокси.  
   Для staging оставьте пустым и `YOOKASSA_WEBHOOK_REQUIRE_SECRET=0`.  
   Premium выдаётся только после `GET /v3/payments/{id}` с Basic auth магазина + сверки суммы/валюты/записи в БД + идемпотентности `premium_granted_at`.
5. Не создавать реальные (live) платежи.

---

## 9. Миграции на тестовой БД

С машины, у которой есть доступ к staging Postgres (не production):

```bash
cd server
export STAGING_DATABASE_URL='postgresql://…/gnh_web_staging?sslmode=require'
npm run migrate:staging:dry    # список файлов
npm run migrate:staging        # schema + 001–014 (003 через staging-fix)
npm run migrate:staging:seed   # + минимальный seed
```

Порядок: `schema` → `001`…`010` → optional roles → `011` → `012`–`014`.  
`003` применяется из `db/staging/003_plans_three_tiers_fixed.sql` (идемпотентный upsert с `id`).

Повторный запуск аддитивных миграций `012`/`013`/`014` и seed безопасен (IF NOT EXISTS / ON CONFLICT).

**Никогда** не запускайте скрипт с URL `gnh_supabase` — скрипт завершится с ошибкой.

---

## 10. Как убедиться, что production не затронут

Чеклист:

- [ ] Staging app — отдельный сервис Timeweb  
- [ ] `DATABASE_URL` указывает на `gnh_web_staging`  
- [ ] Staging стартует с логом `staging = true`  
- [ ] Production сервис/env не менялись  
- [ ] BotFather: правки только у staging-бота  
- [ ] ЮKassa: test shop + test webhook URL  
- [ ] `WEB_DEV_LOGIN_ENABLED=0`  
- [ ] Нет merge в `main`, нет публикации поверх prod  

---

## 11. Проверка на iPhone и Android

После разрешения на публикацию staging:

1. Safari / Chrome: открыть `https://STAGING-DOMAIN/`  
2. Войти через Telegram Login  
3. Профиль → Premium статус (seed-пользователи — через OIDC своего Telegram ID; seed 90000x — для SQL-проверок)  
4. Создать комнату каждой из игр (Sled, Mafia Shadows, Doubles, Infected) с Premium-аккаунтом  
5. Открыть invite URL на втором устройстве без Premium → join по коду  
6. Оплата тестовой ЮKassa → возврат на `/premium?payment=return` → статус после webhook/API  
7. Logout → cookie сессии очищены  
8. Deep link: `/premium`, `/sled?room=111111` с обновлением страницы  

---

## 12. Остановка staging и откат

1. В Timeweb: Stop / undeploy staging-приложения.  
2. Удалить или отключить домен staging.  
3. Опционально: `DROP DATABASE gnh_web_staging;` (только staging).  
4. В BotFather staging-бота можно оставить или удалить; production не трогать.  
5. В тестовой ЮKassa отключить webhook на staging URL.  
6. Локально: `docker compose -f deploy/staging/docker-compose.yml down`.

Откат **не** требует изменений production-сервисов.

---

## Локальный подъём (без Timeweb)

```bash
cp deploy/staging/env.staging.example deploy/staging/.env.staging
# заполнить STAGING DB + тестовые секреты
docker compose -f deploy/staging/docker-compose.yml --env-file deploy/staging/.env.staging up --build
curl -s https://localhost:8080/api/health   # или http://127.0.0.1:8080/api/health
```

Для локального HTTP выставьте `WEB_COOKIE_SECURE=false` и `TRUST_PROXY=0` только в локальном `.env.staging`.
