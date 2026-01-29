# Server — Telegram Card Game (Payments / Stars)

Node.js + TypeScript backend: Telegraf bot + Express API для Mini App и Telegram Payments (Stars).

## Переменные окружения

Создайте файл `server/.env` (или экспортируйте переменные):

| Переменная   | Описание |
|-------------|----------|
| `BOT_TOKEN` | Токен бота от [@BotFather](https://t.me/BotFather) |
| `WEBAPP_URL`| URL Mini App (например `https://your-app.com` или ngrok для разработки) |
| `PORT`     | Порт HTTP-сервера (по умолчанию `3000`) |
| `PRICE_MONTH` | Цена за месяц Premium в Stars (по умолчанию `5`) |
| `PRICE_YEAR`  | Цена за год Premium в Stars (по умолчанию `50`) |

## Установка и запуск

```bash
cd server
npm install
npm run dev
```

Для production: `npm run build` и затем `node dist/index.js` (или `npm start` после сборки).

## API

- **POST /api/invoice**  
  Body: `{ "plan": "month" | "year" }`  
  Заголовок: `X-Telegram-Init-Data` — строка `initData` из WebApp.  
  Ответ: `{ "invoiceLink": "https://t.me/..." }`.

- **GET /api/me**  
  Заголовок: `X-Telegram-Init-Data`.  
  Ответ: `{ "telegramId": number, "premium": boolean, "premiumUntil"?: string }`.

Данные пользователей хранятся в `server/storage.json`.
