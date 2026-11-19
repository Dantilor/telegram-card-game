# Telegram OIDC setup (GameNight Host WEB)

Документация Telegram: https://core.telegram.org/bots/telegram-login

## BotFather

1. Откройте [@BotFather](https://t.me/BotFather) → выберите бота GameNight Host → **Login Widget**.
2. Добавьте Allowed URLs:
   - origin WEB: `https://WEB-DOMAIN`
   - OIDC callback: `https://WEB-DOMAIN/api/web/auth/telegram/callback`
3. Сохраните **Client ID** и **Client Secret** (только на сервере).
4. Advanced: оставьте алгоритм подписи **RS256** (по умолчанию).

## Переменные окружения сервера

См. `server/.env.example` (`TELEGRAM_OIDC_*`, `WEB_*`).

## Поток

1. Браузер → `GET /api/web/auth/telegram/start`
2. Редирект на `https://oauth.telegram.org/auth` (Authorization Code + PKCE S256 + state + nonce)
3. Callback → `GET /api/web/auth/telegram/callback`
4. Сервер обменивает `code`, проверяет `id_token` по JWKS, создаёт строку в `users` при необходимости, выдаёт cookie сессии

Scopes по умолчанию: `openid profile` (без телефона и без `telegram:bot_access`).

## Reverse proxy (предпочтительно)

- `https://WEB-DOMAIN/` — статика WEB
- `https://WEB-DOMAIN/api/` → существующий Express API

Cookie: `HttpOnly` + `Secure` + `SameSite=Lax` на том же сайте (без cross-site cookie).

## Миграция

Аддитивная SQL: `server/db/migrations/012_web_sessions.sql`  
**Не применять к production**, пока не согласован деплой этапа 2A/2B.
