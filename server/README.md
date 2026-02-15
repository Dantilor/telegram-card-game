# Backend for Telegram Card Game

Node.js + Express + TypeScript backend for Mini App premium status and auth.

## Quick start (3 commands)

```bash
cd server
npm install
cp .env.example .env
```

Заполните `.env` (PostgreSQL, TELEGRAM_BOT_TOKEN, CORS_ORIGIN), примените схему БД и запустите:

```bash
psql "$DATABASE_URL" -f db/schema.sql
npm run dev
```

После изменения `schema.sql` выполните миграцию: `psql "$DATABASE_URL" -f db/schema.sql` (из папки server).

---

## Tech stack

- Node 20+
- Express
- TypeScript
- PostgreSQL (pg)
- dotenv, cors, zod

## Environment

| Переменная | Описание |
|------------|----------|
| `PORT` | Порт сервера (по умолчанию 3001) |
| `DATABASE_URL` | PostgreSQL connection string |
| `BOT_TOKEN` или `TELEGRAM_BOT_TOKEN` | Токен бота от @BotFather |
| `BOT_WEBHOOK_PATH` | Путь webhook (по умолчанию `/telegram/webhook-9f3k2lQp`) |
| `WEBAPP_URL` | URL Mini App для кнопки в /start (обязателен для /start) |
| `PUBLIC_URL` или `RENDER_EXTERNAL_URL` | Базовый URL сервера для картинки в /start (на Render — `RENDER_EXTERNAL_URL` задаётся автоматически) |
| `CORS_ORIGIN` | Разрешённый origin, напр. `http://localhost:5173` или `https://dantilor.github.io` |
| `ADMIN_TOKEN` | Секретный токен для Admin API (grant/revoke/user) |
| `YOOKASSA_SHOP_ID` | Идентификатор магазина ЮKassa |
| `YOOKASSA_SECRET_KEY` | Секретный ключ ЮKassa |
| `YOOKASSA_RETURN_URL` | URL возврата после оплаты (напр. Mini App) |
| `YOOKASSA_WEBHOOK_SECRET` | Секрет для проверки webhook (опционально) |

## Database schema

```bash
psql "$DATABASE_URL" -f db/schema.sql
```

Или вручную выполните SQL из `db/schema.sql`.

После изменения схемы всегда выполняйте:
```bash
psql "$DATABASE_URL" -f server/db/schema.sql
```

**Миграция payments** (если таблица payments уже существует со старой схемой):
```bash
psql "$DATABASE_URL" -f server/db/migrations/001_payments_new_schema.sql
```
(Пересоздаёт таблицу payments с колонками provider, amount и UNIQUE по charge_id.)

**Миграция plans + YooKassa**:
```bash
psql "$DATABASE_URL" -f server/db/migrations/002_plans_yookassa.sql
```
(Создаёт таблицу plans, добавляет колонки invoice_payload, status в payments.)

## Запуск

**Development** (hot reload):

```bash
npm run dev
```

**Production**:

```bash
npm run build
npm start
```

## Проверка работы

### 1. Health check

```bash
curl http://localhost:3001/health
```

Ожидается: `ok` и статус 200. Работает без БД.

### 2. Telegram webhook

```bash
curl -i -X POST https://telegram-card-game.onrender.com/telegram/webhook-9f3k2lQp \
  -H "Content-Type: application/json" \
  -d '{}'
```

Ожидается: статус 200 (не 404).

### 3. Hero image (картинка для /start)

```bash
curl -I https://telegram-card-game.onrender.com/public/hero-new.png
```

Ожидается: статус 200.

### 4. Premium status

С валидным `initData` из Telegram WebApp:

```bash
curl -H "X-Telegram-Init-Data: YOUR_INIT_DATA" http://localhost:3001/api/premium-status
```

Ожидается: `{"isPremium":false,"activeUntil":null}` (или `true` при активной подписке).

Без initData: тот же ответ `{"isPremium":false,"activeUntil":null}` — API не падает.

### 5. Включить Premium вручную (для теста)

```sql
INSERT INTO users (telegram_id) VALUES (123456789) ON CONFLICT DO NOTHING;

INSERT INTO subscriptions (telegram_id, plan_id, active_until)
VALUES (123456789, 'premium_6m_259', NOW() + INTERVAL '6 months')
ON CONFLICT (telegram_id, plan_id) DO UPDATE SET active_until = NOW() + INTERVAL '6 months';
```

Подставьте свой `telegram_id` из initData/user.

## API Endpoints

Все API под префиксом `/api`. Health — без префикса.

| Метод | Путь | Описание |
|-------|------|----------|
| GET | /health | Всегда 200, без БД (ответ: `ok`) |
| POST | /telegram/webhook-9f3k2lQp | Telegram webhook (или путь из `BOT_WEBHOOK_PATH`) |
| GET | /api/premium-status | Статус подписки (всегда возвращает JSON, при ошибках — isPremium: false) |
| POST | /api/auth | Регистрация по initData |
| GET | /api/me | User + premium |
| POST | /api/invoice | Создание счёта на оплату (требует x-telegram-init-data) |
| POST | /api/admin/grant | Выдать Premium (требует Bearer ADMIN_TOKEN) |
| POST | /api/admin/revoke | Отозвать Premium (требует Bearer ADMIN_TOKEN) |
| GET | /api/admin/user/:telegramId | Инфо о пользователе + lastPayments (требует Bearer ADMIN_TOKEN) |

## Деплой на Render

### 1. Создать Web Service

1. [Render Dashboard](https://dashboard.render.com) → New → Web Service
2. Подключите репозиторий (GitHub/GitLab)
3. **Root Directory**: `server` (если сервер в подпапке репо)
4. **Runtime**: Node

### 2. Build & Start

| Поле | Значение |
|------|----------|
| Build Command | `npm install && npm run build` |
| Start Command | `npm start` |

### 3. Переменные окружения (Environment Variables)

Добавьте в разделе Environment:

| Переменная | Обязательно | Описание |
|------------|-------------|----------|
| `PORT` | нет (Render задаёт сам) | Порт — Render подставляет автоматически |
| `DATABASE_URL` | да | PostgreSQL connection string (см. ниже) |
| `BOT_TOKEN` или `TELEGRAM_BOT_TOKEN` | да | Токен бота от @BotFather |
| `BOT_WEBHOOK_PATH` | нет | Путь webhook (по умолчанию `/telegram/webhook-9f3k2lQp`) |
| `WEBAPP_URL` | да (для /start) | URL Mini App для кнопки в /start |
| `PUBLIC_URL` | нет | Базовый URL для картинки (если пусто — на Render используется `RENDER_EXTERNAL_URL` автоматически) |
| `CORS_ORIGIN` | да | URL фронтенда, напр. `https://dantilor.github.io` или `https://your-app.vercel.app` |

### 4. PostgreSQL

- New → PostgreSQL → создайте БД
- Скопируйте **Internal Database URL** в `DATABASE_URL`
- После первого деплоя выполните схему:

```bash
psql "postgresql://..." -f db/schema.sql
```

Или через Render Shell: `cd server && psql $DATABASE_URL -f db/schema.sql`

### 5. Результат

После деплоя сервер будет доступен по URL вида `https://your-service.onrender.com`. Проверьте:

```bash
curl https://your-service.onrender.com/health
```

### 6. Фронтенд

При сборке фронтенда задайте `VITE_API_URL=https://your-service.onrender.com`. API base = `/api` (запросы: `/api/me`, `/api/invoice`).

### 7. Admin API и ADMIN_TOKEN

Добавьте переменную `ADMIN_TOKEN` в Environment (Render Dashboard → ваш сервис → Environment). Рекомендуется сгенерировать длинный случайный токен, например:

```bash
openssl rand -hex 32
```

**Примеры curl:**

Выдать Premium на 6 месяцев (по умолчанию):
```bash
curl -X POST https://your-service.onrender.com/api/admin/grant \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"telegramId": 123456789}'
```

Выдать Premium на 12 месяцев:
```bash
curl -X POST https://your-service.onrender.com/api/admin/grant \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"telegramId": 123456789, "months": 12}'
```

Отозвать Premium:
```bash
curl -X POST https://your-service.onrender.com/api/admin/revoke \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"telegramId": 123456789}'
```

Получить инфо о пользователе:
```bash
curl https://your-service.onrender.com/api/admin/user/123456789 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```
