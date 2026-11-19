BEGIN READ ONLY;

SELECT current_database() AS db, current_user AS usr,
       (SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()) AS ssl;

-- Identity gate
SELECT CASE WHEN current_database() = 'gnh_web_staging' THEN 'PASS' ELSE 'FAIL' END AS db_ok,
       CASE WHEN current_user IN ('gnh_web_migrate','gnh_web_stage','gen_user','root') THEN 'PASS' ELSE 'FAIL' END AS user_ok;

-- Succeeded WEB payments (latest first)
SELECT id AS payment_id,
       web_account_id::text AS web_account_id,
       plan_id,
       amount_rub,
       currency,
       status,
       provider,
       created_at AT TIME ZONE 'UTC' AS created_at_utc,
       paid_at AT TIME ZONE 'UTC' AS paid_at_utc,
       premium_granted_at AT TIME ZONE 'UTC' AS premium_granted_at_utc
  FROM web_payments
 WHERE status IN ('succeeded','partially_refunded','refunded')
    OR premium_granted_at IS NOT NULL
 ORDER BY COALESCE(premium_granted_at, paid_at, created_at) DESC
 LIMIT 20;

-- Active WEB entitlements
SELECT e.id,
       e.web_account_id::text AS web_account_id,
       e.plan_id,
       e.source,
       e.payment_id,
       e.linked_telegram_id,
       e.active_until AT TIME ZONE 'UTC' AS active_until_utc,
       e.active_until AT TIME ZONE 'Europe/Moscow' AS active_until_msk,
       (e.active_until > now()) AS is_active_now,
       e.created_at AT TIME ZONE 'UTC' AS created_at_utc
  FROM web_entitlements e
 ORDER BY e.active_until DESC
 LIMIT 20;

-- Join ownership consistency for granted payments
SELECT p.id AS payment_id,
       p.web_account_id::text AS payment_account,
       e.web_account_id::text AS entitlement_account,
       (p.web_account_id = e.web_account_id) AS account_match,
       p.plan_id AS payment_plan,
       e.plan_id AS entitlement_plan,
       (p.plan_id = e.plan_id) AS plan_match,
       p.amount_rub,
       p.currency,
       p.status,
       p.premium_granted_at IS NOT NULL AS granted_flag,
       e.source,
       e.active_until AT TIME ZONE 'Europe/Moscow' AS active_until_msk
  FROM web_payments p
  LEFT JOIN web_entitlements e
    ON e.payment_id = p.id
 WHERE p.premium_granted_at IS NOT NULL
 ORDER BY p.premium_granted_at DESC
 LIMIT 20;

-- Catalog check for plans used in WEB purchases
SELECT COALESCE(plan_id, id) AS plan_key, title, price_rub, duration_days, is_active
  FROM plans
 WHERE COALESCE(plan_id, id) IN (
   SELECT DISTINCT plan_id FROM web_payments WHERE premium_granted_at IS NOT NULL
 )
 ORDER BY 1;

-- Idempotency signals: multiple entitlements per payment_id
SELECT payment_id, count(*)::int AS entitlement_rows
  FROM web_entitlements
 WHERE payment_id IS NOT NULL
 GROUP BY payment_id
 HAVING count(*) > 1;

-- Isolation: telegram payments table vs web (counts only)
SELECT
  (SELECT count(*)::int FROM web_payments WHERE premium_granted_at IS NOT NULL) AS web_granted_payments,
  (SELECT count(*)::int FROM web_entitlements WHERE active_until > now()) AS active_web_entitlements,
  (SELECT count(*)::int FROM web_entitlements WHERE source = 'web_purchase' AND active_until > now()) AS active_web_purchases,
  (SELECT count(*)::int FROM web_entitlements WHERE source = 'telegram_link' AND active_until > now()) AS active_telegram_links,
  (SELECT count(*)::int FROM payments WHERE premium_granted_at IS NOT NULL AND provider = 'yookassa'
     AND created_at > now() - interval '2 days') AS recent_telegram_yookassa_grants;

-- Production isolation metadata (no data read from gnh_supabase)
SELECT has_database_privilege(current_user, 'gnh_supabase', 'CONNECT') AS migrate_can_connect_supabase;

COMMIT;
