# WEB staging — импорт утверждённого legal-пакета

Документы **не создаются с нуля**. Используется уже утверждённый комплект GameNight Host (оферта / соглашение / политика и связанные consent-документы).

Пакет **не хранится в git**. Файл передаётся оператору отдельно (secure channel). CLI: `server/src/legal/cli.ts`.

## Preflight

1. Миграции staging: база до 018 уже применена; для WEB legal subjects — `npm run migrate:staging:019` (см. `WEB_STAGING_MIGRATIONS.md`).
2. App/migrate URL указывает **только** на `gnh_web_staging` (не `gnh_supabase`).
3. Локально: `npm run build:api` в `server/`.

## Dry-run (без записи в БД)

```powershell
cd server
$env:DATABASE_URL = ''   # dry-run import не требует БД
npx tsx src/legal/cli.ts import --file 'C:\secure\gnh-legal-package.json'
```

Ожидается список `document_id version sha256` и `mode: dry-run`.

## Import + активация на staging

```powershell
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
# migrate/admin URL ТОЛЬКО gnh_web_staging
$env:DATABASE_URL = 'postgresql://CLUSTER_ADMIN:PASSWORD@HOST.twc1.net:5432/gnh_web_staging?sslmode=verify-full'
$env:DATABASE_TLS_CA_FILE = 'C:\path\to\timeweb-ca.crt'
$env:GNH_EXPECT_DATABASE = 'gnh_web_staging'

npx tsx src/legal/cli.ts import --file 'C:\secure\gnh-legal-package.json' --write
# Активировать только утверждённый набор (явный список; не "all"):
npx tsx src/legal/cli.ts activate --file 'C:\secure\gnh-legal-package.json' --documents privacy,agreement,offer --write
```

Дополнительные consent-документы (`pd`, `analytics`, …) — только если они входят в утверждённый пакет и согласованы для staging.

## Проверки после импорта

```http
GET /api/legal/documents/offer
GET /api/legal/documents/agreement
GET /api/legal/documents/privacy
```

WEB (cookie session):

1. `POST /api/legal/offer-acceptances` с `version`/`sha256` из GET offer → `evidenceId`.
2. Подтверждения agreement/privacy через WEB legal routes → строки в `web_legal_evidence` / `web_legal_preferences` с `subject_web_account_id`.
3. `POST /api/payments/yookassa/create` **без** `offerAcceptanceId` → отказ.
4. Create **с** `offerAcceptanceId` (версия совпадает с активной) → заказ создаётся.
5. Telegram Mini App legal flow (initData + `legal_evidence`) не должен регрессировать.

## WEB-отличия (не публиковать автоматически)

Черновик точечных правок для анонимного WEB / email / restore: `docs/legal-web-draft/WEB_PRIVACY_AND_TERMS_DRAFT.md`.  
Пока юрист не утвердил WEB-дельту — на staging импортируется **текущий утверждённый** пакет без автопубликации черновика.

## Запреты

- Не импортировать в `gnh_supabase` / production без отдельного разрешения.
- Не коммитить текст пакета и SHA секретов в репозиторий.
- Не активировать `all` одним флагом.
