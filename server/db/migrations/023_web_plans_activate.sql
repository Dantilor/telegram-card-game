-- Phase B: activate WEB plans AFTER the audience-aware API is deployed.
-- Safe rollback if old API must return: deactivate these rows first
--   UPDATE plans SET is_active = false WHERE audience = 'web';
-- Do NOT apply before production API filters /api/plans by audience.

UPDATE plans
   SET is_active = true,
       title = CASE plan_id
         WHEN 'premium_web_1m' THEN 'Premium на 30 дней'
         WHEN 'premium_web_3m' THEN 'Premium на 90 дней'
         WHEN 'premium_web_lifetime' THEN 'Premium навсегда'
         ELSE title
       END,
       price_rub = CASE plan_id
         WHEN 'premium_web_1m' THEN 259
         WHEN 'premium_web_3m' THEN 499
         WHEN 'premium_web_lifetime' THEN 1190
         ELSE price_rub
       END,
       duration_days = CASE plan_id
         WHEN 'premium_web_1m' THEN 30
         WHEN 'premium_web_3m' THEN 90
         WHEN 'premium_web_lifetime' THEN 36500
         ELSE duration_days
       END
 WHERE plan_id IN ('premium_web_1m', 'premium_web_3m', 'premium_web_lifetime')
   AND audience = 'web';