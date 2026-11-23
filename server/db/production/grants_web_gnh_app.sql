-- Production grants for WEB objects to existing app role gnh_app.
-- Apply ONLY on gnh_supabase after WEB migrations 012–021 (+ 024 devices when present).
-- Does NOT copy staging role gnh_web_stage. Safe to re-run.

DO $$
BEGIN
  IF current_database() IS DISTINCT FROM 'gnh_supabase' THEN
    RAISE EXCEPTION 'refusing grants outside gnh_supabase (got %)', current_database();
  END IF;
  IF current_database() = 'gnh_web_staging' THEN
    RAISE EXCEPTION 'refusing production WEB grants on staging database';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'gnh_app') THEN
    RAISE EXCEPTION 'role gnh_app does not exist';
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO gnh_app;

-- Core WEB tables (created by 012/017/018/019/021). Grant only when present.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'web_oidc_states',
    'web_oidc_token_replays',
    'web_sessions',
    'web_accounts',
    'web_entitlements',
    'web_telegram_links',
    'web_telegram_link_challenges',
    'web_telegram_devices',
    'web_email_otps',
    'web_payments',
    'web_rate_buckets',
    'web_legal_evidence',
    'web_legal_preferences',
    'game_session_leases'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO gnh_app', t);
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  seq text;
BEGIN
  FOREACH seq IN ARRAY ARRAY[
    'web_sessions_id_seq',
    'web_entitlements_id_seq',
    'web_telegram_links_id_seq',
    'web_telegram_link_challenges_id_seq',
    'web_email_otps_id_seq',
    'web_legal_evidence_id_seq'
  ]
  LOOP
    IF to_regclass(seq) IS NOT NULL THEN
      EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %I TO gnh_app', seq);
    END IF;
  END LOOP;
END $$;