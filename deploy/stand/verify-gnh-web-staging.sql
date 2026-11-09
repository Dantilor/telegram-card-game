-- Post-migrate verification for gnh_web_staging ONLY.
-- Run as migrate/admin while connected to gnh_web_staging.
-- SELECT / privilege probes only. No REVOKE / ALTER ROLE / production writes.

SELECT current_database() AS db, current_user AS usr;
-- Expect: db = gnh_web_staging

SELECT tablename
  FROM pg_tables
 WHERE schemaname = 'public'
   AND tablename IN (
     'users', 'subscriptions', 'payments', 'plans',
     'web_sessions', 'web_oidc_states', 'web_oidc_token_replays',
     'legal_evidence',
     'sled_rooms', 'mafia_rooms', 'doubles_rooms', 'infected_rooms'
   )
 ORDER BY 1;

SELECT pg_get_constraintdef(oid) AS infected_code_check
  FROM pg_constraint
 WHERE conname = 'infected_rooms_code_format';
-- Expect: CHECK (code ~ '^[A-Z0-9]{6}$')

SELECT has_table_privilege('gnh_web_stage', 'users', 'SELECT') AS users_select,
       has_table_privilege('gnh_web_stage', 'web_sessions', 'INSERT') AS sessions_insert,
       has_table_privilege('gnh_web_stage', 'infected_rooms', 'INSERT') AS infected_insert;

SELECT pg_has_role('gnh_web_stage', 'gnh_app', 'member') AS stage_is_gnh_app_member;
-- Expect: false

SELECT pol.polname, pol.polrelid::regclass AS rel
  FROM pg_policy pol
 WHERE pol.polname = 'party_gnh_web_stage_backend'
 ORDER BY 2;

-- Metadata-only CONNECT probe (no production schema changes).
-- If this errors because gnh_supabase is invisible to the session, that is OK.
SELECT has_database_privilege('gnh_web_stage', 'gnh_supabase', 'CONNECT') AS stage_can_connect_supabase;
-- Prefer false. If true, restrict CONNECT in Timeweb panel later (do not REVOKE from this script).
