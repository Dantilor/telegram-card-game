-- Anonymous WEB accounts (additive). Never apply to gnh_supabase without explicit approval.
-- Independent of users.telegram_id — no synthetic Telegram IDs.

CREATE TABLE IF NOT EXISTS web_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  email_normalized TEXT,
  email_verified_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  CONSTRAINT web_accounts_email_normalized_len CHECK (
    email_normalized IS NULL OR (char_length(email_normalized) BETWEEN 3 AND 320)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS web_accounts_email_normalized_uidx
  ON web_accounts (email_normalized)
  WHERE email_normalized IS NOT NULL AND revoked_at IS NULL;

COMMENT ON TABLE web_accounts IS
  'Anonymous WEB identities. Not Telegram users. Session cookie maps here.';

-- Allow WEB sessions without telegram_id (anonymous) OR with telegram_id (OIDC legacy).
ALTER TABLE web_sessions
  ALTER COLUMN telegram_id DROP NOT NULL;

ALTER TABLE web_sessions
  ADD COLUMN IF NOT EXISTS web_account_id UUID REFERENCES web_accounts (id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'web_sessions_subject_chk'
  ) THEN
    ALTER TABLE web_sessions
      ADD CONSTRAINT web_sessions_subject_chk CHECK (
        (telegram_id IS NOT NULL AND web_account_id IS NULL)
        OR (telegram_id IS NULL AND web_account_id IS NOT NULL)
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS web_sessions_web_account_id_idx
  ON web_sessions (web_account_id)
  WHERE revoked_at IS NULL AND web_account_id IS NOT NULL;

-- Premium purchased or restored onto a WEB account (not Telegram subscriptions table).
CREATE TABLE IF NOT EXISTS web_entitlements (
  id BIGSERIAL PRIMARY KEY,
  web_account_id UUID NOT NULL REFERENCES web_accounts (id),
  plan_id TEXT NOT NULL,
  source TEXT NOT NULL,
  active_until TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payment_id TEXT,
  linked_telegram_id BIGINT,
  CONSTRAINT web_entitlements_source_chk CHECK (
    source IN ('web_purchase', 'telegram_link', 'manual_staging')
  )
);

CREATE INDEX IF NOT EXISTS web_entitlements_account_active_idx
  ON web_entitlements (web_account_id, active_until DESC);

COMMENT ON TABLE web_entitlements IS
  'WEB-side Premium rights. Telegram subscriptions remain untouched.';

CREATE TABLE IF NOT EXISTS web_telegram_links (
  id BIGSERIAL PRIMARY KEY,
  web_account_id UUID NOT NULL REFERENCES web_accounts (id),
  telegram_id BIGINT NOT NULL,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  CONSTRAINT web_telegram_links_telegram_positive CHECK (telegram_id > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS web_telegram_links_active_telegram_uidx
  ON web_telegram_links (telegram_id)
  WHERE revoked_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS web_telegram_links_active_account_uidx
  ON web_telegram_links (web_account_id)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS web_telegram_link_challenges (
  id BIGSERIAL PRIMARY KEY,
  web_account_id UUID NOT NULL REFERENCES web_accounts (id),
  code_hash CHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  attempts INT NOT NULL DEFAULT 0,
  CONSTRAINT web_telegram_link_challenges_hash_hex CHECK (code_hash ~ '^[0-9a-f]{64}$')
);

CREATE INDEX IF NOT EXISTS web_telegram_link_challenges_account_idx
  ON web_telegram_link_challenges (web_account_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS web_email_otps (
  id BIGSERIAL PRIMARY KEY,
  web_account_id UUID NOT NULL REFERENCES web_accounts (id),
  email_normalized TEXT NOT NULL,
  code_hash CHAR(64) NOT NULL,
  purpose TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  attempts INT NOT NULL DEFAULT 0,
  CONSTRAINT web_email_otps_purpose_chk CHECK (purpose IN ('bind', 'recover')),
  CONSTRAINT web_email_otps_hash_hex CHECK (code_hash ~ '^[0-9a-f]{64}$')
);

CREATE INDEX IF NOT EXISTS web_email_otps_account_idx
  ON web_email_otps (web_account_id, purpose, expires_at DESC);

-- WEB payment ledger (separate from Telegram-oriented payments.telegram_id).
CREATE TABLE IF NOT EXISTS web_payments (
  id TEXT PRIMARY KEY,
  web_account_id UUID NOT NULL REFERENCES web_accounts (id),
  plan_id TEXT NOT NULL,
  amount_rub INT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'RUB',
  status TEXT NOT NULL DEFAULT 'pending',
  provider TEXT NOT NULL DEFAULT 'yookassa',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ,
  premium_granted_at TIMESTAMPTZ,
  CONSTRAINT web_payments_amount_positive CHECK (amount_rub > 0)
);

CREATE INDEX IF NOT EXISTS web_payments_account_idx
  ON web_payments (web_account_id, created_at DESC);
