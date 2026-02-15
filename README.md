# Telegram Card Game (Mini App)

Telegram Mini App (WebApp) — карточная игра на React + Vite + TypeScript с [@twa-dev/sdk](https://github.com/twa-dev/sdk).

## Стек

- **Frontend:** React 18, Vite 5, TypeScript
- **Telegram:** @twa-dev/sdk (WebApp API, без бота и polling)

## Установка

```bash
npm install
```

## Запуск

```bash
npm run dev
```

Сборка:

```bash
npm run build
```

Превью сборки:

```bash
npm run preview
```

## Подключение как Mini App

1. Создайте бота в [@BotFather](https://t.me/BotFather).
2. В настройках бота задайте **Menu Button** или **Web App** URL на ваш хостинг (после деплоя) или на туннель (например ngrok) для разработки.
3. Открывайте приложение через кнопку меню или команду в боте.

**Белая полоса сверху?** Настройте Loading Screen в BotFather: [docs/TELEGRAM_HEADER.md](docs/TELEGRAM_HEADER.md)

## Структура

```
telegram-card-game/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── src/
│   ├── main.tsx      # WebApp.ready(), WebApp.expand(), рендер React
│   ├── App.tsx
│   ├── App.css
│   ├── index.css
│   └── vite-env.d.ts
└── public/
```
