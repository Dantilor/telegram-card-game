# GNH-WEB-Test — ops перед Premium (без LIVE / без Timeweb deploy)

## 1. ЮKassa TEST

Локально / mock:

```env
YOOKASSA_MOCK=1
YOOKASSA_WEBHOOK_SECRET=local-mock-webhook
```

Staging TEST shop (не LIVE):

```env
YOOKASSA_SHOP_ID=<test_shop_id>
YOOKASSA_SECRET_KEY=<test_secret>
YOOKASSA_WEBHOOK_SECRET=<shared_bearer>
YOOKASSA_WEBHOOK_REQUIRE_SECRET=1
YOOKASSA_RETURN_URL=https://<staging-web-host>/payment/return
# YOOKASSA_MOCK must stay unset/0 on Timeweb staging
```

В кабинете ЮKassa (тест):

1. Webhook URL → `https://<staging-api>/api/yookassa/webhook`
2. События: `payment.succeeded`, `payment.canceled`, `refund.succeeded`
3. Authorization: Bearer = `YOOKASSA_WEBHOOK_SECRET`
4. Проверить, что shop = **тест**, не боевой

Поведение кода:

- return_url / `POST /api/yookassa/confirm` **не** считает оплату успешной без API `succeeded`
- WEB grant идёт по `web_account_id` + `web_payments` (Telegram ID не обязателен)
- `refund.succeeded` проверяется через `GET /v3/refunds/{id}`; частичный → `partially_refunded` без отзыва; полный → revoke только `web_purchase` этого paymentId

## 2. SMTP relay (OTP)

Email **чека** (тело create payment) ≠ email **восстановления** (bind/recover OTP).

```env
SMTP_ENABLED=1
SMTP_FROM=noreply@your-domain.example
SMTP_RELAY_URL=https://relay.example/v1/send
SMTP_RELAY_TOKEN=<optional_bearer>
```

Проверка:

1. `POST /api/web/email/bind/start` → письмо с 8-значным кодом (на staging без relay в non-prod возможен test transport + echo code).
2. `verify` привязывает email к `web_account_id`.
3. Новое устройство / без cookie → `recover/start` + `recover/complete` выдаёт новую session.
4. Rate-limit / hashed OTP / anti-enumeration на recover сохранены.

Реальная отправка через relay на Timeweb — после выставления env на стенде (этот репозиторий не деплоит).

## 3. План проверки Telegram Premium restore

**Staging не использует production bot token и production Telegram DB.**

Безопасный тестовый сценарий:

1. WEB staging: Профиль → «Восстановить покупку из Telegram» → экран с кодом, TTL, копированием, авто-poll.
2. Mini App **staging-бота** (отдельный token) → `/link-web` → ввод кода.
3. Complete принимает только `telegram_init_data` → реальный `telegram_id`.
4. Код одноразовый; повтор / истечение → ошибка; UI предлагает новый код.
5. При активной `subscriptions` у этого telegram_id → entitlement `telegram_link` на WEB + Lifetime/дата в UI.
6. E2E/local mock: `WEB_TELEGRAM_LINK_ECHO` + `complete-mock` **только** non-production.

Production-привязка к живым пользователям — отдельный согласованный релиз (не этот PR).

## 4. Миграция 019

См. `docs/WEB_STAGING_MIGRATIONS.md` § «Миграция 019 only».
