-- Grants and RLS policies for the API role on the phone-party tables.
-- Apply as the table owner after role gnh_app exists.
-- These tables enable RLS and do not force it. The owner bypasses RLS.
-- gnh_app is not the owner and does not bypass RLS, so GRANT alone is not enough.
-- Safe to run again.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'gnh_app') THEN
    RAISE EXCEPTION 'role gnh_app does not exist';
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  sled_rooms, sled_participants, sled_room_events,
  mafia_rooms, mafia_players, mafia_actions, mafia_events,
  doubles_rooms, doubles_players,
  infected_rooms, infected_players
TO gnh_app;

GRANT USAGE, SELECT ON SEQUENCE
  sled_room_events_id_seq,
  mafia_actions_id_seq,
  mafia_events_id_seq
TO gnh_app;

DO $$
DECLARE
  rel text;
BEGIN
  FOREACH rel IN ARRAY ARRAY[
    'sled_rooms', 'sled_participants', 'sled_room_events',
    'mafia_rooms', 'mafia_players', 'mafia_actions', 'mafia_events',
    'doubles_rooms', 'doubles_players',
    'infected_rooms', 'infected_players'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS party_gnh_app_backend ON %I', rel);
    EXECUTE format(
      'CREATE POLICY party_gnh_app_backend ON %I FOR ALL TO gnh_app USING (true) WITH CHECK (true)',
      rel
    );
  END LOOP;
END $$;
