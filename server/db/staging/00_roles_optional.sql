-- Staging role policy: do NOT create or alter cluster-wide production roles.
--
-- PostgreSQL roles are cluster-scoped. Creating/altering `gnh_app` (or granting
-- membership in it) from a staging session would affect the whole cluster,
-- including production GameNight Host.
--
-- Staging app access uses LOGIN role `gnh_web_stage` only (created in Timeweb
-- panel). Table grants + RLS policies are applied in 01_grants_gnh_web_stage.sql.
-- This file is intentionally a guard / no-op.

DO $$
BEGIN
  IF current_database() = 'gnh_supabase' THEN
    RAISE EXCEPTION 'refusing staging role guard on production database gnh_supabase';
  END IF;
  IF current_database() IS DISTINCT FROM 'gnh_web_staging' THEN
    RAISE EXCEPTION 'refusing staging role guard outside gnh_web_staging (got %)', current_database();
  END IF;

  -- Never create or alter gnh_app here. If it already exists in the cluster,
  -- leave it untouched (no GRANT/REVOKE/ALTER/CREATE).
  RAISE NOTICE 'staging role guard: skipping gnh_app create/alter; use gnh_web_stage grants only';
END $$;
