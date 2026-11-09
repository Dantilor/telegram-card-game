-- Staging-safe replacement for migrations/003_plans_three_tiers.sql
-- Production 003 INSERT omits PRIMARY KEY `id` when only plan_id is set.
-- This file always sets id = plan_id and is idempotent.

ALTER TABLE plans ADD COLUMN IF NOT EXISTS plan_id TEXT;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT now();

UPDATE plans SET plan_id = id WHERE plan_id IS NULL AND id IS NOT NULL;

INSERT INTO plans (id, plan_id, title, price_rub, duration_days, is_active, updated_at)
VALUES
  ('premium_1m', 'premium_1m', 'Premium на 1 месяц', 259, 30, true, now()),
  ('premium_3m', 'premium_3m', 'Premium на 3 месяца', 399, 90, true, now()),
  ('premium_lifetime', 'premium_lifetime', 'Premium навсегда', 990, 36500, true, now())
ON CONFLICT (id) DO UPDATE SET
  plan_id = EXCLUDED.plan_id,
  title = EXCLUDED.title,
  price_rub = EXCLUDED.price_rub,
  duration_days = EXCLUDED.duration_days,
  is_active = EXCLUDED.is_active,
  updated_at = now();
