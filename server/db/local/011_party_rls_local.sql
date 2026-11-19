-- Local-only party RLS for gnh_web_local. Does not touch gnh_app / gnh_supabase / Timeweb roles.

DO $$
BEGIN
  IF current_database() = 'gnh_supabase' THEN
    RAISE EXCEPTION 'refusing local party RLS on production database gnh_supabase';
  END IF;
  IF current_database() IS DISTINCT FROM 'gnh_web_local' THEN
    RAISE EXCEPTION 'refusing party RLS outside gnh_web_local (got %)', current_database();
  END IF;
END $$;

ALTER TABLE sled_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE sled_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE sled_room_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE mafia_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE mafia_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE mafia_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mafia_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE doubles_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE doubles_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE infected_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE infected_players ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  sled_rooms, sled_participants, sled_room_events,
  mafia_rooms, mafia_players, mafia_actions, mafia_events,
  doubles_rooms, doubles_players,
  infected_rooms, infected_players
FROM PUBLIC;

REVOKE ALL ON SEQUENCE
  sled_room_events_id_seq,
  mafia_actions_id_seq,
  mafia_events_id_seq
FROM PUBLIC;

GRANT ALL ON TABLE
  sled_rooms, sled_participants, sled_room_events,
  mafia_rooms, mafia_players, mafia_actions, mafia_events,
  doubles_rooms, doubles_players,
  infected_rooms, infected_players
TO CURRENT_USER;

GRANT USAGE, SELECT, UPDATE ON SEQUENCE
  sled_room_events_id_seq,
  mafia_actions_id_seq,
  mafia_events_id_seq
TO CURRENT_USER;
