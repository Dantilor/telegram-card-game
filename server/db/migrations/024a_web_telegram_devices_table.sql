-- 024a: web_telegram_devices table + legacy seed.
-- Production: apply as a role with CREATE on schema public (typically gen_user).
-- Does NOT ALTER web_telegram_link_challenges (see 024b; owner is often gnh_app).
-- Idempotent. Do not apply without backup + approval.

CREATE TABLE IF NOT EXISTS web_telegram_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id BIGINT NOT NULL,
  web_account_id UUID NOT NULL REFERENCES web_accounts (id),
  device_token_hash CHAR(64) NOT NULL,
  display_label TEXT,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  idle_expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  revoke_reason TEXT,
  is_legacy BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT web_telegram_devices_telegram_positive CHECK (telegram_id > 0),
  CONSTRAINT web_telegram_devices_hash_hex CHECK (device_token_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT web_telegram_devices_revoke_reason_chk CHECK (
    revoke_reason IS NULL
    OR revoke_reason IN (
      'user_logout',
      'remote_revoke',
      'idle_expire',
      'replaced',
      'legacy_claim',
      'unlink'
    )
  ),
  CONSTRAINT web_telegram_devices_label_len CHECK (
    display_label IS NULL OR char_length(display_label) BETWEEN 1 AND 120
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS web_telegram_devices_active_token_uidx
  ON web_telegram_devices (device_token_hash)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS web_telegram_devices_active_telegram_idx
  ON web_telegram_devices (telegram_id, last_active_at DESC)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS web_telegram_devices_active_account_idx
  ON web_telegram_devices (web_account_id)
  WHERE revoked_at IS NULL;

COMMENT ON TABLE web_telegram_devices IS
  'Authorized WEB/PWA installations for Telegram Premium. Max 3 active per telegram_id (enforced in app).';

-- Seed one legacy slot per existing active link so current users keep Premium after migrate.
INSERT INTO web_telegram_devices (
  telegram_id,
  web_account_id,
  device_token_hash,
  display_label,
  is_legacy,
  linked_at,
  last_active_at,
  idle_expires_at
)
SELECT
  l.telegram_id,
  l.web_account_id,
  md5('legacy-a:' || l.id::text) || md5('legacy-b:' || l.id::text),
  'WEB-устройство',
  true,
  l.linked_at,
  now(),
  now() + interval '30 days'
FROM web_telegram_links l
WHERE l.revoked_at IS NULL
  AND NOT EXISTS (
    SELECT 1
      FROM web_telegram_devices d
     WHERE d.telegram_id = l.telegram_id
       AND d.web_account_id = l.web_account_id
       AND d.revoked_at IS NULL
  );
