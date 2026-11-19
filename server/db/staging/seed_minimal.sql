-- Minimal STAGING seed. Synthetic telegram_ids only. No production PII/payments.
-- Idempotent. Run AFTER migrations against gnh_web_staging (never gnh_supabase).
-- Party rooms use non-production codes; host tokens are random hashes (not shared as login secrets).

INSERT INTO users (telegram_id) VALUES
  (900001), -- no premium
  (900002), -- premium 1m
  (900003), -- lifetime
  (900004)  -- expired
ON CONFLICT (telegram_id) DO NOTHING;

INSERT INTO subscriptions (telegram_id, plan_id, active_until, created_at)
VALUES
  (900002, 'premium_1m', now() + interval '30 days', now()),
  (900003, 'premium_lifetime', now() + interval '100 years', now()),
  (900004, 'premium_1m', now() - interval '7 days', now() - interval '40 days')
ON CONFLICT (telegram_id, plan_id) DO UPDATE SET
  active_until = EXCLUDED.active_until;

-- Demo Sled lobby (guest join by code only; host must create via authenticated API for real play).
DO $$
DECLARE
  host_id text := 'seed-sled-host-900002';
BEGIN
  IF to_regclass('public.sled_rooms') IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO sled_rooms (
    code, host_participant_id, case_id, mode, status, state, revision, created_at, updated_at, expires_at
  ) VALUES (
    '111111',
    host_id,
    'demo',
    'standard',
    'lobby',
    '{}'::jsonb,
    1,
    now(),
    now(),
    now() + interval '2 hours'
  )
  ON CONFLICT (code) DO NOTHING;

  INSERT INTO sled_participants (
    id, room_code, token_hash, name, role_id, seat, is_host, ready, joined_at, last_seen_at
  ) VALUES (
    host_id,
    '111111',
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'Staging Host',
    'detective',
    0,
    true,
    false,
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'sled seed skipped: %', SQLERRM;
END $$;
