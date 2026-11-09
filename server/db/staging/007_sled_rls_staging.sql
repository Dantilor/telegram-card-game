-- Staging-only SLED RLS (replaces migrations/007_sled_rls.sql on gnh_web_staging).
-- Does NOT grant/policy/alter production role gnh_app (cluster-wide).
-- Run only while connected to gnh_web_staging.

DO $$
BEGIN
  IF current_database() = 'gnh_supabase' THEN
    RAISE EXCEPTION 'refusing staging sled RLS on production database gnh_supabase';
  END IF;
  IF current_database() IS DISTINCT FROM 'gnh_web_staging' THEN
    RAISE EXCEPTION 'refusing sled RLS outside gnh_web_staging (got %)', current_database();
  END IF;
END $$;

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

REVOKE ALL ON TABLE sled_rooms FROM PUBLIC;
REVOKE ALL ON TABLE sled_participants FROM PUBLIC;
REVOKE ALL ON TABLE sled_room_events FROM PUBLIC;
REVOKE ALL ON SEQUENCE sled_room_events_id_seq FROM PUBLIC;

-- Table owner / migrate admin retains access (bypasses RLS as owner).
GRANT ALL ON TABLE sled_rooms TO CURRENT_USER;
GRANT ALL ON TABLE sled_participants TO CURRENT_USER;
GRANT ALL ON TABLE sled_room_events TO CURRENT_USER;
GRANT USAGE, SELECT, UPDATE ON SEQUENCE sled_room_events_id_seq TO CURRENT_USER;

-- Close Supabase-style client roles when present; no-op if missing.
-- Does not touch gnh_app.
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
