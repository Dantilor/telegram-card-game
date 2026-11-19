BEGIN READ ONLY;
SELECT current_database() AS db, current_user AS role;
SELECT ssl, version AS tls FROM pg_stat_ssl WHERE pid = pg_backend_pid();

SELECT id, web_account_id::text, plan_id, amount_rub, status,
       paid_at, premium_granted_at, created_at
FROM web_payments
ORDER BY COALESCE(paid_at, created_at) DESC NULLS LAST
LIMIT 20;

SELECT e.id, e.web_account_id::text, e.plan_id, e.source, e.payment_id,
       e.active_until, e.created_at
FROM web_entitlements e
ORDER BY e.active_until DESC NULLS LAST
LIMIT 20;

SELECT p.id AS payment_id, p.web_account_id::text, p.plan_id, p.amount_rub, p.status,
       p.premium_granted_at,
       e.source, e.active_until, e.payment_id AS entitlement_payment_id
FROM web_payments p
LEFT JOIN web_entitlements e
  ON e.payment_id = p.id AND e.web_account_id = p.web_account_id
WHERE p.status = 'succeeded'
ORDER BY p.premium_granted_at DESC NULLS LAST
LIMIT 10;

SELECT COUNT(*) AS telegram_payments_touched
FROM payments
WHERE provider = 'yookassa'
  AND updated_at > now() - interval '2 days';

SELECT COUNT(*) AS active_web_premium
FROM web_entitlements
WHERE active_until > now();
COMMIT;
