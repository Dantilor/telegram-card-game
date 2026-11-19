-- Local-only SLED RLS for database gnh_web_local (never gnh_supabase / never Timeweb staging).
-- Same hardening as production 007, gated to local DB name.

DO $$
BEGIN
  IF current_database() = 'gnh_supabase' THEN
    RAISE EXCEPTION 'refusing local sled RLS on production database gnh_supabase';
  END IF;
  IF current_database() IS DISTINCT FROM 'gnh_web_local' THEN
    RAISE EXCEPTION 'refusing sled RLS outside gnh_web_local (got %)', current_database();
  END IF;
END $$;

ALTER TABLE sled_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE sled_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE sled_room_events ENABLE ROW LEVEL SECURITY;

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

GRANT ALL ON TABLE sled_rooms TO CURRENT_USER;
GRANT ALL ON TABLE sled_participants TO CURRENT_USER;
GRANT ALL ON TABLE sled_room_events TO CURRENT_USER;
GRANT USAGE, SELECT, UPDATE ON SEQUENCE sled_room_events_id_seq TO CURRENT_USER;
