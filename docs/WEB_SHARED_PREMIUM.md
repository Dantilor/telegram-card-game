# Shared Premium (Telegram ↔ WEB)

After a verified `web_telegram_links` row exists (Mini App initData code complete, or staging complete-mock):

- **Telegram → WEB:** `getWebAccountPremium` includes the linked Telegram `subscriptions` row.
- **WEB → Telegram:** `getTelegramPremium` includes linked `web_entitlements` with `source=web_purchase` (and `manual_staging`).

`/api/me` and `/api/premium-status` use these resolvers for both shells.

## Non-goals / safety

- WEB purchases are **not** copied into `subscriptions` (no duplicate grant, no re-link extension).
- Unlink expires only `telegram_link` audit entitlements; original Telegram Stars/`subscriptions` and WEB `web_purchase` rows remain.
- Access never trusts a raw Telegram ID from the body — only verified initData / session.
