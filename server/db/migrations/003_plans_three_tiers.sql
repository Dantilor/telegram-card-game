-- Three premium tiers (safe upsert; does not modify existing subscriptions)

ALTER TABLE plans ADD COLUMN IF NOT EXISTS plan_id TEXT;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT now();

UPDATE plans SET plan_id = id WHERE plan_id IS NULL AND id IS NOT NULL;

-- premium_1m
UPDATE plans
SET title = 'Premium на 1 месяц', price_rub = 259, duration_days = 30, is_active = true, updated_at = now()
WHERE plan_id = 'premium_1m';

INSERT INTO plans (plan_id, title, price_rub, duration_days, is_active)
SELECT 'premium_1m', 'Premium на 1 месяц', 259, 30, true
WHERE NOT EXISTS (SELECT 1 FROM plans WHERE plan_id = 'premium_1m');

-- premium_3m
UPDATE plans
SET title = 'Premium на 3 месяца', price_rub = 399, duration_days = 90, is_active = true, updated_at = now()
WHERE plan_id = 'premium_3m';

INSERT INTO plans (plan_id, title, price_rub, duration_days, is_active)
SELECT 'premium_3m', 'Premium на 3 месяца', 399, 90, true
WHERE NOT EXISTS (SELECT 1 FROM plans WHERE plan_id = 'premium_3m');

-- premium_lifetime
UPDATE plans
SET title = 'Premium навсегда', price_rub = 990, duration_days = 36500, is_active = true, updated_at = now()
WHERE plan_id = 'premium_lifetime';

INSERT INTO plans (plan_id, title, price_rub, duration_days, is_active)
SELECT 'premium_lifetime', 'Premium навсегда', 990, 36500, true
WHERE NOT EXISTS (SELECT 1 FROM plans WHERE plan_id = 'premium_lifetime');
