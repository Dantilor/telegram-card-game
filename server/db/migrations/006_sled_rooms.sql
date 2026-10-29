-- SLED multiplayer rooms (PostgreSQL)
-- Apply manually after 005_legal_documents.sql:
--   psql "$DATABASE_URL" -f server/db/migrations/006_sled_rooms.sql

CREATE TABLE IF NOT EXISTS sled_rooms (
  code TEXT PRIMARY KEY,
  host_participant_id TEXT NOT NULL,
  case_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'lobby',
  state JSONB NOT NULL DEFAULT '{}'::jsonb,
  revision INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS sled_rooms_expires_at_idx ON sled_rooms (expires_at);

CREATE TABLE IF NOT EXISTS sled_participants (
  id TEXT PRIMARY KEY,
  room_code TEXT NOT NULL REFERENCES sled_rooms(code) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role_id TEXT NOT NULL,
  seat INTEGER NOT NULL,
  is_host BOOLEAN NOT NULL DEFAULT FALSE,
  ready BOOLEAN NOT NULL DEFAULT FALSE,
  vote_round INTEGER,
  vote_district TEXT,
  ability_used BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sled_participants_room_seat_uidx UNIQUE (room_code, seat),
  CONSTRAINT sled_participants_token_uidx UNIQUE (token_hash)
);

CREATE INDEX IF NOT EXISTS sled_participants_room_idx ON sled_participants (room_code);

CREATE TABLE IF NOT EXISTS sled_room_events (
  id BIGSERIAL PRIMARY KEY,
  room_code TEXT NOT NULL REFERENCES sled_rooms(code) ON DELETE CASCADE,
  participant_id TEXT NOT NULL REFERENCES sled_participants(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sled_room_events_room_id_idx ON sled_room_events (room_code, id);
