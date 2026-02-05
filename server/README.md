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
psql $DATABASE_URL -f db/schema.sql
npm run dev
```

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
| `TELEGRAM_BOT_TOKEN` | Токен бота от @BotFather |
| `CORS_ORIGIN` | Разрешённый origin, напр. `http://localhost:5173` или `https://dantilor.github.io` |

## Database schema

```bash
psql $DATABASE_URL -f db/schema.sql
```

Или вручную выполните SQL из `db/schema.sql`.

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

Ожидается: `{"ok":true}` и статус 200. Работает без БД.

### 2. Premium status

С валидным `initData` из Telegram WebApp:

```bash
curl -H "X-Telegram-Init-Data: YOUR_INIT_DATA" http://localhost:3001/api/premium-status
```

Ожидается: `{"isPremium":false,"activeUntil":null}` (или `true` при активной подписке).

Без initData: тот же ответ `{"isPremium":false,"activeUntil":null}` — API не падает.

### 3. Включить Premium вручную (для теста)

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
| GET | /health | Всегда 200, без БД |
| GET | /api/premium-status | Статус подписки (всегда возвращает JSON, при ошибках — isPremium: false) |
| POST | /api/auth | Регистрация по initData |
| GET | /api/me | User + premium |
| POST | /api/invoice | Создание счёта на оплату (требует x-telegram-init-data) |

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
| `TELEGRAM_BOT_TOKEN` | да | Токен бота от @BotFather |
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
