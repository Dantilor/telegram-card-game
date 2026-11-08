# Локальный запуск GameNight Host WEB

## Требования

- Node 20+
- Локальный PostgreSQL / PGlite-тесты (не production Timeweb)
- Применённые миграции `012_web_sessions.sql` и желательно `013_web_session_profile.sql` на **тестовой** БД

## Команды

```bash
# API
cd server
cp .env.example .env
# DATABASE_URL=... (локальная БД)
# WEB_COOKIE_SECURE=false
# WEB_DEV_LOGIN_ENABLED=1
# WEB_DEV_LOGIN_SECRET=local-dev-secret-change-me
# TELEGRAM_OIDC_* когда готов реальный Login
npm run dev

# WEB frontend (отдельный терминал, корень репозитория)
npm run dev:web
```

Откройте `http://localhost:5173/`. Vite proxy направляет `/api` на `http://127.0.0.1:3001`.

## Вход

- Кнопка «Войти через Telegram» → `/api/web/auth/telegram/start` (нужен настроенный OIDC).
- Либо локальный dev-login (только при `WEB_DEV_LOGIN_ENABLED=1`):

```bash
curl -i -X POST http://127.0.0.1:3001/api/web/auth/dev-login \
  -H "Content-Type: application/json" \
  -d "{\"telegramId\":123456,\"secret\":\"local-dev-secret-change-me\",\"displayName\":\"Test Host\"}"
```

Затем откройте WEB с теми же cookies (через proxy same-origin проще после реализации cookie на 5173 — для dev-login через proxy:

```bash
curl -i -c cookies.txt -X POST http://localhost:5173/api/web/auth/dev-login \
  -H "Content-Type: application/json" \
  -d "{\"telegramId\":123456,\"secret\":\"local-dev-secret-change-me\",\"displayName\":\"Test Host\"}"
```

## Сборки

```bash
npm run build        # Mini App → dist/, base /telegram-card-game/
npm run build:web    # WEB → dist-web/, base /
```

## Предпочтительный production shape (ещё не деплоить)

- `https://web-domain/` → static `dist-web`
- `https://web-domain/api/` → reverse proxy на существующий Express
