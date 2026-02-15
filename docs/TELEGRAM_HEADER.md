# Настройка Mini App в Telegram

## 1. Header и полный экран

Если верхняя панель (header) остаётся белой или приложение открывается в половинном экране:

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

**Приложение открывается в половинном экране?** URL Mini App не должен содержать `mode=compact`. Проверьте в BotFather URL кнопки меню / Web App.

**Примечание:** `setHeaderColor` / `setBackgroundColor` вызываются из приложения, но на некоторых версиях клиента (особенно Desktop) они могут не срабатывать. Настройка в BotFather — надёжный способ убрать белую полосу при загрузке.
