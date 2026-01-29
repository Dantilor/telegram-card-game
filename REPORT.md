# Отчёт: Telegram Card Game (Mini App)

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
