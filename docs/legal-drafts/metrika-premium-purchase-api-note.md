# Что нужно API, чтобы включить цель `premium_purchase`

Сейчас клиент видит только `premium: boolean` и `activeUntil` (`/api/me`, `/api/premium-status`).

Этого недостаточно, чтобы отличить:

- Premium, который уже был до checkout;
- восстановление доступа / login;
- возврат с `?payment=return` без успешной новой оплаты;
- реальную новую выдачу после webhook ЮKassa.

**Минимальное безопасное изменение (предложение):**

После успешного grant по webhook отдавать в `/api/me` (или отдельный лёгкий endpoint) поле вроде:

- `premiumEntitlementRevision` — монотонное число / ISO-время последнего grant **без** paymentId, email, telegram id;

Клиент при старте оплаты запоминает revision; цель `premium_purchase` шлётся только если после return revision ** Strictly greater**, и только один раз на этот переход.

Пока этого нет, `PREMIUM_PURCHASE_METRIKA_ENABLED = false` в `src/analytics/metrikaGoals.ts`.