# Что нужно API, чтобы включить цель `premium_purchase`

**Статус:** план. Не включать `PREMIUM_PURCHASE_METRIKA_ENABLED` и не менять боевую схему БД без согласования.

Сейчас клиент видит только `premium: boolean` и `activeUntil` (`/api/me`, `/api/premium-status`).

Этого недостаточно, чтобы отличить:

- Premium, который уже был до checkout;
- восстановление доступа / login;
- возврат с `?payment=return` без успешной новой оплаты;
- реальную новую выдачу после webhook ЮKassa.

## Предлагаемый серверный сигнал (без PII / paymentId)

Добавить в ответ **WEB** `/api/me` (и при необходимости `/api/premium-status` для WEB) поле:

```json
{
  "premiumEntitlementRevision": "2026-11-24T16:02:11.123Z"
}
```

Семантика:

- ISO-время **последней успешной выдачи** Premium для текущего web-аккаунта
  (из уже существующего `web_payments.premium_granted_at` MAX / либо `web_entitlements.updated_at` при grant).
- Без `paymentId`, email, telegram id, amount.
- Не меняет логику YooKassa webhook и Telegram Premium: только чтение уже записанного grant-времени.
- Для аккаунта без grant — `null`.

Альтернатива с минимальным риском утечки: монотонный `bigint` revision, инкремент только в существующем grant-транзакте (потребует колонку — согласовать отдельно; предпочтительнее reuse `premium_granted_at`, если колонка уже пишется).

## Клиентский протокол

1. Перед редиректом в ЮKassa (`premium_payment_start`): сохранить `baselineRevision` из `/api/me` в `sessionStorage` (не в Метрику).
2. После return / poll: снова читать `/api/me`.
3. Слать `reachGoal('premium_purchase')` **только если**:
   - согласие Метрики granted;
   - был checkout-pending;
   - `premium === true`;
   - `premiumEntitlementRevision` строкой и **строго новее** `baselineRevision` (или baseline был `null`, а revision появился);
   - для этой revision ещё не отправляли (ключ в `sessionStorage`, без paymentId).
4. Restore / «Войти по email» / уже-premium без роста revision — **не** слать.
5. Reload после успешной отправки — не слать повторно (ключ session + сравнение revision).

## Что не делать

- Не слать paymentId / charge id / email в `reachGoal`.
- Не считать покупкой «просто стал premium» или `?payment=return`.
- Не трогать Telegram Mini App grant path для этой цели (WEB-only Metrika).
- Не включать флаг, пока поле не в staging API и не покрыто тестами.

## План тестов перед включением

1. Unit: revision comparison + dedupe + disabled flag.
2. API: grant webhook → revision растёт; повторный webhook idempotent → revision не дёргается ложно.
3. E2E mock: checkout → mock succeed → одна `premium_purchase`; restore → 0; reload → 0; already-premium cancel → 0.
4. Regression: YooKassa create/webhook, Premium Checkout UI, Mini App payments untouched.

Пока этого нет, `PREMIUM_PURCHASE_METRIKA_ENABLED = false` в `src/analytics/metrikaGoals.ts`.