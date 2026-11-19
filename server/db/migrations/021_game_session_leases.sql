-- Additive: concurrent game-session leases (max 3 per owner). Safe to re-run.

CREATE TABLE IF NOT EXISTS game_session_leases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_lease_id TEXT NOT NULL,
  web_account_id UUID REFERENCES web_accounts (id),
  telegram_id BIGINT,
  owner_lock_key TEXT NOT NULL,
  game_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  released_at TIMESTAMPTZ,
  CONSTRAINT game_session_leases_subject_chk CHECK (
    web_account_id IS NOT NULL OR telegram_id IS NOT NULL
  ),
  CONSTRAINT game_session_leases_client_len CHECK (char_length(client_lease_id) BETWEEN 8 AND 128),
  CONSTRAINT game_session_leases_owner_len CHECK (char_length(owner_lock_key) BETWEEN 3 AND 200),
  CONSTRAINT game_session_leases_game_len CHECK (char_length(game_id) BETWEEN 1 AND 64)
);

CREATE UNIQUE INDEX IF NOT EXISTS game_session_leases_active_client_uidx
  ON game_session_leases (client_lease_id)
  WHERE released_at IS NULL;

CREATE INDEX IF NOT EXISTS game_session_leases_owner_active_idx
  ON game_session_leases (owner_lock_key, expires_at DESC)
  WHERE released_at IS NULL;

CREATE INDEX IF NOT EXISTS game_session_leases_expires_idx
  ON game_session_leases (expires_at)
  WHERE released_at IS NULL;

COMMENT ON TABLE game_session_leases IS
  'Active game-session leases. Limits concurrent play slots (not launches/devices/rounds).';