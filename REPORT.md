# Отчёт: Telegram Card Game (Mini App)

## Исправление подвисаний (Telegram WebView, 2025)

### Причины подвисаний
1. **Синхронная запись в localStorage при каждом setState** — блокировала главный поток на мобилке (45+ записей за игру).
2. **useEffect с зависимостью от state** — лишние перезапуски при инициализации прогресса колоды.
3. **Первый рендер Play** — тяжёлый чанк загружался при клике, блокируя UI.
4. **getMe 404 на GitHub Pages** — запрос к несуществующему /api/me при hostname github.io.

### Внесённые изменения
- **useLocalState**: debounce 600ms + flush на visibilitychange/beforeunload. Запись в localStorage батчами.
- **Play**: progress init через useRef + startTransition, функциональные setState, useMemo для favoriteQuestions.
- **React.lazy + Suspense** для Play, prefetch при заходе на Decks.
- **useSyncPremium**: не вызывает getMe на github.io без VITE_API_BASE.
- **api/client**: baseURL из VITE_API_BASE.
- **MicroConfetti**: useMemo для particles (не пересоздавать при каждом render).
- **perf.ts**: performance.mark под ?debug=1 / DEV.

### WebSocket
Ошибки WebSocket из web.telegram.org — не от нашего приложения. В коде нет ws/WebSocket.

---

## DONE

- Проект на **Vite + React + TypeScript**
- Подключены **react-router-dom** и **@twa-dev/sdk**
- Базовая структура: страницы, data, hooks, components
- Роутинг: `/` (Колоды), `/play` (Игра), `/profile` (Профиль)
- Без логики игры и без оплаты — только каркас

---

## Files created

```
telegram-card-game/
├── .gitignore
├── eslint.config.js
├── index.html
├── package.json
├── README.md
├── REPORT.md          ← этот отчёт
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── vite.config.ts
├── public/
│   └── vite.svg
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── App.css
    ├── index.css
    ├── vite-env.d.ts
    ├── pages/
    │   ├── Decks.tsx
    │   ├── Play.tsx
    │   └── Profile.tsx
    ├── data/
    │   └── decks.ts
    ├── hooks/
    │   └── .gitkeep
    └── components/
        └── .gitkeep
```

---

## How to run the project

```bash
cd telegram-card-game
npm install
npm run dev
```

Открыть в браузере: `http://localhost:5173` (или адрес из вывода Vite).

Проверка маршрутов:
- `http://localhost:5173/#/` — Колоды
- `http://localhost:5173/#/play` — Игра
- `http://localhost:5173/#/profile` — Профиль

Сборка:
```bash
npm run build
npm run preview
```

---

## TODO (что дальше по этапам)

| Этап | Задача |
|------|--------|
| **1** | Данные колод: типы, мок-данные в `data/decks.ts`, отображение списка на странице Decks |
| **2** | Навигация: переход из Decks в Play (выбор колоды), ссылки/кнопки на Profile |
| **3** | Страница Play: экран игры (раздача, ход, результат), базовая логика без оплаты |
| **4** | Профиль: данные пользователя из Telegram WebApp (initData), аватар, имя |
| **5** | Оформление: стили под Telegram (theme vars), адаптив, кнопки/карточки |
| **6** | Оплата (если нужно): Telegram Payments / Stars, премиум-колоды или подсказки |

Можно начинать с этапа 1 (данные колод и список на Decks).
