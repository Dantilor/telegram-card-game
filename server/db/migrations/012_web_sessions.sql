-- WEB browser sessions + Telegram OIDC login state (additive only).
-- Do NOT apply to production until Stage 2A is approved for deploy.
-- Uses existing users(telegram_id). Does not alter payments, subscriptions, or Mini App auth.

CREATE TABLE IF NOT EXISTS web_oidc_states (
  state TEXT PRIMARY KEY,
  code_verifier TEXT NOT NULL,
  nonce TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  return_to TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS web_oidc_states_expires_at_idx
  ON web_oidc_states (expires_at);

COMMENT ON TABLE web_oidc_states IS
  'Short-lived Telegram OIDC Authorization Code + PKCE state. Consumed once.';

CREATE TABLE IF NOT EXISTS web_oidc_token_replays (
  token_hash CHAR(64) PRIMARY KEY,
  telegram_id BIGINT NOT NULL,
  consumed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT web_oidc_token_replays_hash_hex CHECK (token_hash ~ '^[0-9a-f]{64}$')
);

CREATE INDEX IF NOT EXISTS web_oidc_token_replays_expires_at_idx
  ON web_oidc_token_replays (expires_at);

COMMENT ON TABLE web_oidc_token_replays IS
  'One-time use of Telegram OIDC id_token hashes to block replay.';

CREATE TABLE IF NOT EXISTS web_sessions (
  id BIGSERIAL PRIMARY KEY,
  token_hash CHAR(64) NOT NULL UNIQUE,
  csrf_hash CHAR(64) NOT NULL,
  telegram_id BIGINT NOT NULL REFERENCES users (telegram_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  user_agent_hash CHAR(64),
  CONSTRAINT web_sessions_token_hash_hex CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT web_sessions_csrf_hash_hex CHECK (csrf_hash ~ '^[0-9a-f]{64}$')
);

CREATE INDEX IF NOT EXISTS web_sessions_telegram_id_idx
  ON web_sessions (telegram_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS web_sessions_expires_at_idx
  ON web_sessions (expires_at)
  WHERE revoked_at IS NULL;

COMMENT ON TABLE web_sessions IS
  'Browser WEB sessions. Stores only SHA-256 hashes of session and CSRF tokens.';
