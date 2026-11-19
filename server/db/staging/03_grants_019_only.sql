-- Staging grants ONLY for objects introduced by migration 019 (web legal subjects).
-- Run on gnh_web_staging as migrate role AFTER 019. Safe to re-run.
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
  web_legal_evidence,
  web_legal_preferences
TO gnh_web_stage;

DO $$
BEGIN
  IF to_regclass('web_legal_evidence_id_seq') IS NOT NULL THEN
    EXECUTE 'GRANT USAGE, SELECT ON SEQUENCE web_legal_evidence_id_seq TO gnh_web_stage';
  END IF;
END $$;
