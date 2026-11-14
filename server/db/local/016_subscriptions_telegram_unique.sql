-- Local alignment with extendPremiumActiveUntil ON CONFLICT (telegram_id).
-- Production gnh_supabase already has one subscription row per user.
-- Never run against gnh_supabase.

DO $$
BEGIN
  IF current_database() = 'gnh_supabase' THEN
    RAISE EXCEPTION 'refusing local subscription unique on production database gnh_supabase';
  END IF;
  IF current_database() IS DISTINCT FROM 'gnh_web_local' THEN
    RAISE EXCEPTION 'refusing outside gnh_web_local (got %)', current_database();
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_telegram_id_uidx ON subscriptions (telegram_id);
