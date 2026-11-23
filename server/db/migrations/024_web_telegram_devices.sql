-- WEB device slots for Telegram Premium (max 3 per telegram_id).
-- Additive expand-and-contract. Do not apply to production without backup + approval.
-- Feature flag GNH_WEB_DEVICE_LIMIT_ENABLED gates enforcement in application code.
--
-- Production note: if web_telegram_link_challenges is owned by gnh_app and CREATE on
-- public is only available to gen_user, apply 024a then 024b via the production
-- dual-role migrator (do not ALTER OWNER / do not broaden privileges casually).

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
-- 64-hex placeholder from md5 pair (no pgcrypto digest dependency).
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
ALTER TABLE web_telegram_link_challenges
  ADD COLUMN IF NOT EXISTS device_token_hash CHAR(64);

ALTER TABLE web_telegram_link_challenges
  ADD COLUMN IF NOT EXISTS adopted_web_account_id UUID REFERENCES web_accounts (id);

COMMENT ON COLUMN web_telegram_link_challenges.device_token_hash IS
  'Hash of WEB gnh_web_device cookie captured at challenge start.';
COMMENT ON COLUMN web_telegram_link_challenges.adopted_web_account_id IS
  'When complete adopts an anonymous WEB account into the primary linked account.';

ALTER TABLE web_telegram_link_challenges
  ADD COLUMN IF NOT EXISTS last_error_code TEXT;

ALTER TABLE web_telegram_link_challenges
  ADD COLUMN IF NOT EXISTS last_error_at TIMESTAMPTZ;

COMMENT ON COLUMN web_telegram_link_challenges.last_error_code IS
  'Last complete failure visible to WEB status polling (e.g. device_limit_reached).';