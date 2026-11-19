-- Additive profile snapshot on WEB sessions (Stage 2B).
-- Does not alter users, subscriptions, or payments.
-- Do NOT apply to production until approved.

ALTER TABLE web_sessions ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE web_sessions ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE web_sessions ADD COLUMN IF NOT EXISTS picture_url TEXT;

COMMENT ON COLUMN web_sessions.display_name IS
  'OIDC profile name snapshot for the browser session (not a second identity store).';
