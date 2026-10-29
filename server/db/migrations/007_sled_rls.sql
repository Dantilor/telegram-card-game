-- SLED RLS lockdown (PostgreSQL)
-- Apply with the same DATABASE_URL role the backend uses:
--   psql "$DATABASE_URL" -f server/db/migrations/007_sled_rls.sql
-- Touches only sled_* relations. Safe if anon/authenticated roles are absent.

-- Row Level Security: no policies for client roles.
-- Table owner / superuser (typical backend DATABASE_URL) retains access without
-- broad "allow all" policies. FORCE is intentionally not set.
ALTER TABLE sled_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE sled_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE sled_room_events ENABLE ROW LEVEL SECURITY;

-- Drop any accidental permissive policies on sled_* only (idempotent).
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('sled_rooms', 'sled_participants', 'sled_room_events')
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      pol.policyname,
      pol.schemaname,
      pol.tablename
    );
  END LOOP;
END $$;

-- Remove default PUBLIC privileges (only sled_*).
REVOKE ALL ON TABLE sled_rooms FROM PUBLIC;
REVOKE ALL ON TABLE sled_participants FROM PUBLIC;
REVOKE ALL ON TABLE sled_room_events FROM PUBLIC;
REVOKE ALL ON SEQUENCE sled_room_events_id_seq FROM PUBLIC;

-- Backend role = the role applying this migration (DATABASE_URL user).
GRANT ALL ON TABLE sled_rooms TO CURRENT_USER;
GRANT ALL ON TABLE sled_participants TO CURRENT_USER;
GRANT ALL ON TABLE sled_room_events TO CURRENT_USER;
GRANT USAGE, SELECT, UPDATE ON SEQUENCE sled_room_events_id_seq TO CURRENT_USER;

-- The API role is not the table owner and does not bypass RLS.
-- Without a policy, GRANT alone still returns zero rows. Apply this migration
-- after the role exists. If it does not exist yet, 011 repeats the grant.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'gnh_app') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE sled_rooms, sled_participants, sled_room_events TO gnh_app';
    EXECUTE 'GRANT USAGE, SELECT ON SEQUENCE sled_room_events_id_seq TO gnh_app';
    EXECUTE 'DROP POLICY IF EXISTS sled_gnh_app_backend ON sled_rooms';
    EXECUTE 'DROP POLICY IF EXISTS sled_gnh_app_backend ON sled_participants';
    EXECUTE 'DROP POLICY IF EXISTS sled_gnh_app_backend ON sled_room_events';
    EXECUTE 'CREATE POLICY sled_gnh_app_backend ON sled_rooms FOR ALL TO gnh_app USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY sled_gnh_app_backend ON sled_participants FOR ALL TO gnh_app USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY sled_gnh_app_backend ON sled_room_events FOR ALL TO gnh_app USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- Close Supabase-style client roles when present; no-op locally if missing.
DO $$
DECLARE
  client_role TEXT;
BEGIN
  FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
      EXECUTE format('REVOKE ALL ON TABLE sled_rooms FROM %I', client_role);
      EXECUTE format('REVOKE ALL ON TABLE sled_participants FROM %I', client_role);
      EXECUTE format('REVOKE ALL ON TABLE sled_room_events FROM %I', client_role);
      EXECUTE format('REVOKE ALL ON SEQUENCE sled_room_events_id_seq FROM %I', client_role);
    END IF;
  END LOOP;
END $$;
