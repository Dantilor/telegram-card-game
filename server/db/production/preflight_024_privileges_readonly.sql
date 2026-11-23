-- READ-ONLY privilege probe for migration 024 (no DDL/DML).
-- Run as gen_user on gnh_supabase. Does not change passwords/roles/owners.

SELECT current_database() AS db, current_user AS usr;

SELECT
  has_schema_privilege(current_user, 'public', 'CREATE') AS gen_create_public,
  has_schema_privilege('gnh_app', 'public', 'CREATE') AS gnh_app_create_public,
  has_table_privilege(current_user, 'web_telegram_links', 'SELECT') AS gen_select_links,
  has_table_privilege(current_user, 'web_accounts', 'REFERENCES') AS gen_refs_accounts,
  has_table_privilege('gnh_app', 'web_telegram_links', 'SELECT') AS gnh_select_links,
  has_table_privilege('gnh_app', 'web_accounts', 'REFERENCES') AS gnh_refs_accounts;

SELECT c.relname AS table_name,
       pg_get_userbyid(c.relowner) AS owner
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public'
   AND c.relkind = 'r'
   AND c.relname IN (
     'web_accounts',
     'web_telegram_links',
     'web_telegram_link_challenges',
     'web_telegram_devices'
   )
 ORDER BY 1;

SELECT r.rolname, r.rolcanlogin, r.rolsuper,
       pg_has_role(current_user, r.oid, 'member') AS gen_user_is_member
  FROM pg_roles r
 WHERE r.rolname IN ('gen_user', 'gnh_app')
 ORDER BY 1;

-- Interpretation (no writes):
-- A) gnh_app_create_public AND challenges owner=gnh_app
--    → single-role apply as gnh_app (024 combined or 024a+024b+grants).
-- B) gen_create_public AND challenges owner=gnh_app AND NOT gnh_app_create_public
--    → dual-role: gen_user applies 024a+grants; gnh_app applies 024b.
-- C) otherwise → blocked; do not ALTER OWNER / GRANT new rights without separate review.