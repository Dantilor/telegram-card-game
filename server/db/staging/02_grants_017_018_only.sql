-- Staging grants ONLY for objects introduced by migrations 017 + 018.
-- Run on gnh_web_staging as migrate role AFTER 017/018. Safe to re-run.
-- Does NOT touch gnh_supabase or production roles.

DO $$
BEGIN
  IF current_database() = 'gnh_supabase' THEN
    RAISE EXCEPTION 'refusing grants on production database gnh_supabase';
  END IF;
  IF current_database() IS DISTINCT FROM 'gnh_web_staging' THEN
    RAISE EXCEPTION 'refusing grants outside gnh_web_staging (got %)', current_database();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'gnh_web_stage') THEN
    RAISE EXCEPTION 'role gnh_web_stage does not exist';
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  web_accounts,
  web_entitlements,
  web_telegram_links,
  web_telegram_link_challenges,
  web_email_otps,
  web_payments,
  web_rate_buckets,
  web_legal_evidence,
  web_legal_preferences
TO gnh_web_stage;

-- web_sessions already granted historically; ensure UPDATE for web_account_id column use.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE web_sessions TO gnh_web_stage;

DO $$
DECLARE
  seq text;
BEGIN
  FOREACH seq IN ARRAY ARRAY[
    'web_entitlements_id_seq',
    'web_telegram_links_id_seq',
    'web_telegram_link_challenges_id_seq',
    'web_email_otps_id_seq',
    'web_legal_evidence_id_seq'
  ]
  LOOP
    IF to_regclass(seq) IS NOT NULL THEN
      EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %I TO gnh_web_stage', seq);
    END IF;
  END LOOP;
END $$;
