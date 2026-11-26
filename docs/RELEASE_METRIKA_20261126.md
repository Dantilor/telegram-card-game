# Релиз Яндекс Метрики (счётчик 114652319) — ручной деплой

Ветка: `release/gnh-web-metrika-20261126` (база — production `be57d85` + только Метрика/юридический API).
Секретов в репозитории нет. Приватный legal-пакет (`_private_legal_import/`) в Git не попадает (gitignore).

## 1. Timeweb: переключение ветки
Приложения → приложение с доменом play.gamenighthost.ru → «Настройки» / «Деплой»:
- Ветка: `feature/gnh-web-email-premium-restore-20261125` → `release/gnh-web-metrika-20261126`
- Dockerfile: `Dockerfile.production` (без изменений), контекст — корень репозитория.
- Переменные окружения НЕ менять. `VITE_GNH_METRIKA_ENABLED=1` уже закоммичен в `.env.web` и применяется при Docker-сборке WEB.
- Коммит: последний коммит ветки (SHA указан в отчёте). Нажать «Собрать и задеплоить».

## 2. Проверка запуска
- `https://play.gamenighthost.ru/health` → 200 `{"ok":true,...}`
- Сайт открывается, вход по email-коду, Premium-страница, любая игра работают.
- `POST /api/legal/metrika-consent` без сессии больше не 404 (ожидаемо 401/403/400).
- Бот отвечает в Telegram, Mini App открывается (не менялись).

До шага 3 (privacy 2026-11-26.2 не активна) баннер Метрики покажется, но «Разрешить Метрику» вернёт ошибку и счётчик НЕ загрузится (fail-closed: сервер отклоняет согласие, 409 `privacy_not_active`). Сайт при этом работает штатно.

## 3. Публикация privacy 2026-11-26.2 (нужен пароль gen_user, владелец БД)
Выполнять на своём компьютере, из корня репозитория, где есть `_private_legal_import/`. Пароль вводится в скрытом prompt, нигде не сохраняется.

```powershell
# 1) добавить редакции (без активации)
powershell -ExecutionPolicy Bypass -File .\_private_legal_import\Activate-PrivacyMetrika.ps1 -Action Import
# 2) активировать ТОЛЬКО privacy
powershell -ExecutionPolicy Bypass -File .\_private_legal_import\Activate-PrivacyMetrika.ps1 -Action ActivatePrivacy
```

Эквивалент вручную (из `server/`, переменные задать в сессии, не в файлах):
```powershell
$env:DATABASE_URL = 'postgresql://gen_user:<ПАРОЛЬ>@87c1743b41396e20e77b82cc.twc1.net:5432/gnh_supabase'
$env:DATABASE_TLS_CA_FILE = '..\_private_legal_import\timeweb-ca.crt'
$env:DATABASE_TLS_SERVERNAME = 'managed-service.timeweb.cloud'
npx tsx src/legal/cli.ts import   --file ../_private_legal_import/documents.json            # dry-run
npx tsx src/legal/cli.ts import   --file ../_private_legal_import/documents.json --write
npx tsx src/legal/cli.ts activate --file ../_private_legal_import/documents.json --documents privacy          # dry-run
npx tsx src/legal/cli.ts activate --file ../_private_legal_import/documents.json --documents privacy --write
```
Не активировать offer, agreement, analytics и остальные. Старые редакции и подтверждения сохраняются.
Проверка: `GET https://play.gamenighthost.ru/api/legal/documents/privacy` → `version: 2026-11-26.2`.

## 4. Проверка Метрики после согласия
1. Открыть сайт в чистом окне (инкогнито) с `?utm_source=test&utm_medium=cpc`. В DevTools → Network до выбора нет запросов к `mc.yandex.ru`.
2. Нажать «Разрешить Метрику» → появляется запрос `mc.yandex.ru/watch/114652319` (UTM сохраняются; в URL хита нет email/токенов).
3. Профиль → «Отозвать» → запросы прекращаются после перезагрузки.
4. Отказ («Отказаться») — запросов нет.
Цели: `game_open`, `game_start`, `premium_view`, `premium_payment_start`. `premium_purchase` выключена намеренно.

## 5. Откат на be57d85
- Timeweb: ветка обратно на `feature/gnh-web-email-premium-restore-20261125` (коммит `be57d85`) → деплой.
- Если privacy уже активирована и нужен возврат редакции: из `_private_legal_import` / backup-пакета активировать `privacy` версии `2026-10-20.1`
  (`activate --file <backup-package>.json --documents privacy --write`). Данные согласий не удаляются.