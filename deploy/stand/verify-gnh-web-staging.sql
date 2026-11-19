-- Post-migrate verification for gnh_web_staging ONLY.
-- Run as migrate/admin while connected to gnh_web_staging (TLS verify-full).
-- SELECT / privilege / catalog probes only.
-- No INSERT/UPDATE/DELETE. No REVOKE / GRANT / ALTER ROLE. No production writes.
-- Prefer: .\deploy\stand\Verify-GnhWebStaging.ps1 (structured PASS/FAIL).

-- 1) Identity (expect db = gnh_web_staging)
SELECT current_database() AS db, current_user AS usr;

-- 2) Core + WEB + legal + Premium + payments + party tables
SELECT tablename
  FROM pg_tables
 WHERE schemaname = 'public'
   AND tablename IN (
     'users', 'subscriptions', 'payments', 'plans', 'events',
     'web_sessions', 'web_oidc_states', 'web_oidc_token_replays',
     'legal_document_versions', 'legal_document_activations',
     'legal_evidence', 'legal_preferences', 'marketing_queue',
     'sled_rooms', 'sled_participants', 'sled_room_events',
     'mafia_rooms', 'mafia_players', 'mafia_actions', 'mafia_events',
     'doubles_rooms', 'doubles_players',
     'infected_rooms', 'infected_players'
   )
 ORDER BY 1;

-- 3) Infected room code format (expect CHECK code ~ '^[A-Z0-9]{6}$')
SELECT pg_get_constraintdef(oid) AS infected_code_check
  FROM pg_constraint
 WHERE conname = 'infected_rooms_code_format';

-- 4) App-role privileges via catalog functions only (no test rows)
SELECT
  has_table_privilege('gnh_web_stage', 'users', 'SELECT') AS users_select,
  has_table_privilege('gnh_web_stage', 'users', 'INSERT') AS users_insert,
  has_table_privilege('gnh_web_stage', 'subscriptions', 'SELECT') AS subscriptions_select,
  has_table_privilege('gnh_web_stage', 'payments', 'SELECT') AS payments_select,
  has_table_privilege('gnh_web_stage', 'payments', 'INSERT') AS payments_insert,
  has_table_privilege('gnh_web_stage', 'plans', 'SELECT') AS plans_select,
  has_table_privilege('gnh_web_stage', 'web_sessions', 'SELECT') AS sessions_select,
  has_table_privilege('gnh_web_stage', 'web_sessions', 'INSERT') AS sessions_insert,
  has_table_privilege('gnh_web_stage', 'legal_evidence', 'SELECT') AS legal_evidence_select,
  has_table_privilege('gnh_web_stage', 'legal_evidence', 'INSERT') AS legal_evidence_insert,
  has_table_privilege('gnh_web_stage', 'infected_rooms', 'SELECT') AS infected_select,
  has_table_privilege('gnh_web_stage', 'infected_rooms', 'INSERT') AS infected_insert,
  has_table_privilege('gnh_web_stage', 'sled_rooms', 'INSERT') AS sled_insert,
  has_table_privilege('gnh_web_stage', 'mafia_rooms', 'INSERT') AS mafia_insert,
  has_table_privilege('gnh_web_stage', 'doubles_rooms', 'INSERT') AS doubles_insert;

-- 5) Isolation: app role must not inherit production role
SELECT pg_has_role('gnh_web_stage', 'gnh_app', 'member') AS stage_is_gnh_app_member;
-- Expect: false

-- 6) Party RLS policies for gnh_web_stage
SELECT pol.polname, pol.polrelid::regclass AS rel
  FROM pg_policy pol
 WHERE pol.polname = 'party_gnh_web_stage_backend'
 ORDER BY 2;

-- 7) Plans present (from migration 003-fixed; no INSERT here)
SELECT COALESCE(plan_id, id) AS plan_key, title, price_rub, duration_days, is_active
  FROM plans
 ORDER BY 1;

-- 8) Seed presence (report only — do not insert)
SELECT
  (SELECT count(*)::int FROM users WHERE telegram_id BETWEEN 900001 AND 900004) AS seed_users,
  (SELECT count(*)::int FROM subscriptions) AS subscription_rows,
  (SELECT count(*)::int FROM payments) AS payment_rows,
  (SELECT count(*)::int FROM legal_document_versions) AS legal_versions,
  (SELECT count(*)::int FROM legal_document_activations) AS legal_activations,
  (SELECT count(*)::int FROM web_sessions) AS web_session_rows,
  (SELECT count(*)::int FROM sled_rooms) AS sled_rooms,
  (SELECT count(*)::int FROM mafia_rooms) AS mafia_rooms,
  (SELECT count(*)::int FROM doubles_rooms) AS doubles_rooms,
  (SELECT count(*)::int FROM infected_rooms) AS infected_rooms;

-- 9) Metadata-only CONNECT probe vs production DB name (no production data reads).
-- If this errors because gnh_supabase is invisible, that is OK / treated as isolated.
SELECT has_database_privilege('gnh_web_stage', 'gnh_supabase', 'CONNECT') AS stage_can_connect_supabase;
-- Prefer false. If true, restrict CONNECT in Timeweb panel later (do not REVOKE from this script).
