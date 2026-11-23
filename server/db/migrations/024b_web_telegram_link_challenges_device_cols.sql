-- 024b: device-limit columns on web_telegram_link_challenges.
-- Production: apply as the table owner (observed: gnh_app). gen_user cannot ALTER this table.
-- Idempotent ADD COLUMN IF NOT EXISTS. Do not apply without backup + approval.

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
