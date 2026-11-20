-- Additive: isolate WEB catalog prices from Telegram Mini App plans.
-- Phase A (safe before/with API deploy): schema + inactive WEB rows.
-- Old APIs that list all active plans will NOT see WEB tariffs until 023 activates them.
-- Does NOT change existing premium_1m / premium_3m / premium_lifetime prices.
--
-- Production gnh_supabase `plans` uses `plan_id` (no `id` column). Staging may still have
-- legacy `id` PK — insert both shapes via information_schema detection.

ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS audience TEXT NOT NULL DEFAULT 'all';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'plans_audience_check'
  ) THEN
    ALTER TABLE plans
      ADD CONSTRAINT plans_audience_check
      CHECK (audience IN ('all', 'telegram', 'web'));
  END IF;
END $$;

UPDATE plans
   SET audience = 'telegram'
 WHERE plan_id IN ('premium_1m', 'premium_3m', 'premium_lifetime')
   AND audience = 'all';

-- Insert WEB plans inactive so legacy /api/plans (all active rows) cannot leak them to Telegram.
DO $$
DECLARE
  has_id boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'plans' AND column_name = 'id'
  ) INTO has_id;

  IF has_id THEN
    INSERT INTO plans (id, plan_id, title, price_rub, duration_days, is_active, audience)
    SELECT 'premium_web_1m', 'premium_web_1m', 'Premium на 30 дней', 259, 30, false, 'web'
    WHERE NOT EXISTS (SELECT 1 FROM plans WHERE plan_id = 'premium_web_1m' OR id = 'premium_web_1m');

    INSERT INTO plans (id, plan_id, title, price_rub, duration_days, is_active, audience)
    SELECT 'premium_web_3m', 'premium_web_3m', 'Premium на 90 дней', 499, 90, false, 'web'
    WHERE NOT EXISTS (SELECT 1 FROM plans WHERE plan_id = 'premium_web_3m' OR id = 'premium_web_3m');

    INSERT INTO plans (id, plan_id, title, price_rub, duration_days, is_active, audience)
    SELECT 'premium_web_lifetime', 'premium_web_lifetime', 'Premium навсегда', 1190, 36500, false, 'web'
    WHERE NOT EXISTS (
      SELECT 1 FROM plans WHERE plan_id = 'premium_web_lifetime' OR id = 'premium_web_lifetime'
    );
  ELSE
    INSERT INTO plans (plan_id, title, price_rub, duration_days, is_active, audience)
    SELECT 'premium_web_1m', 'Premium на 30 дней', 259, 30, false, 'web'
    WHERE NOT EXISTS (SELECT 1 FROM plans WHERE plan_id = 'premium_web_1m');

    INSERT INTO plans (plan_id, title, price_rub, duration_days, is_active, audience)
    SELECT 'premium_web_3m', 'Premium на 90 дней', 499, 90, false, 'web'
    WHERE NOT EXISTS (SELECT 1 FROM plans WHERE plan_id = 'premium_web_3m');

    INSERT INTO plans (plan_id, title, price_rub, duration_days, is_active, audience)
    SELECT 'premium_web_lifetime', 'Premium навсегда', 1190, 36500, false, 'web'
    WHERE NOT EXISTS (SELECT 1 FROM plans WHERE plan_id = 'premium_web_lifetime');
  END IF;
END $$;

-- If rows already exist from an earlier draft of 022, keep them but do not force-activate here.
UPDATE plans
   SET audience = 'web'
 WHERE plan_id IN ('premium_web_1m', 'premium_web_3m', 'premium_web_lifetime')
   AND audience <> 'web';

CREATE INDEX IF NOT EXISTS plans_audience_active_idx
  ON plans (audience, is_active)
  WHERE is_active = true;
