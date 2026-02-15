# Настройка header Mini App в Telegram

Если верхняя панель (header) остаётся белой, настройте **Loading Screen** в BotFather:

## Шаги

1. Откройте [@BotFather](https://t.me/BotFather)
2. `/mybots` → выберите бота
3. **Bot Settings** → **Configure Mini App** (или **Configure Web App**)
4. **Edit Web App** → найдите **Loading screen** / **Загрузочный экран**
5. Установите цвета:
   - **Dark theme background**: `#070814` (или цвет вашей тёмной темы)
   - **Light theme background**: `#e8e6f5` (для светлой темы)

Так Telegram не покажет белую заставку при открытии Mini App.

---

**Примечание:** `setHeaderColor` / `setBackgroundColor` вызываются из приложения, но на некоторых версиях клиента (особенно Desktop) они могут не срабатывать. Настройка в BotFather — надёжный способ убрать белую полосу при загрузке.
