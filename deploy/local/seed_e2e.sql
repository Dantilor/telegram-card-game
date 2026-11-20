-- Synthetic E2E seed for gnh_web_local only. No production PII.
-- Idempotent. Never run against gnh_supabase or Timeweb staging.

DO $$
BEGIN
  IF current_database() = 'gnh_supabase' THEN
    RAISE EXCEPTION 'refusing E2E seed on production database gnh_supabase';
  END IF;
  IF current_database() IS DISTINCT FROM 'gnh_web_local' THEN
    RAISE EXCEPTION 'refusing E2E seed outside gnh_web_local (got %)', current_database();
  END IF;
END $$;

INSERT INTO users (telegram_id) VALUES
  (900001), -- free
  (900002), -- premium 1m
  (900003), -- lifetime
  (900004)  -- expired
ON CONFLICT (telegram_id) DO NOTHING;

-- Force-reset seed Premium rows so local drift (mock payments, prior grants)
-- cannot leave 900004 "expired" still active, or 900001 free with leftover Premium.
DELETE FROM subscriptions WHERE telegram_id BETWEEN 900001 AND 900004;

INSERT INTO subscriptions (telegram_id, plan_id, active_until, created_at)
VALUES
  (900002, 'premium_1m', now() + interval '30 days', now()),
  (900003, 'premium_lifetime', now() + interval '100 years', now()),
  (900004, 'premium_1m', now() - interval '7 days', now() - interval '40 days');

-- Clear prior WEB/Telegram links for seed users so restore E2E stays isolated.
UPDATE web_telegram_links
   SET revoked_at = now()
 WHERE telegram_id BETWEEN 900001 AND 900004
   AND revoked_at IS NULL;

UPDATE web_entitlements
   SET active_until = LEAST(active_until, now() - interval '1 second'),
       updated_at = now()
 WHERE source = 'telegram_link'
   AND linked_telegram_id BETWEEN 900001 AND 900004
   AND active_until > now();

-- Minimal synthetic offer for local Premium checkout (not production legal text).
INSERT INTO legal_document_versions (
  document_id, version, title, kind, scope, document_date, sha256, body_markdown, blocks, requires_individual_details
)
SELECT
  'offer',
  '2026-01-01.1',
  'Локальная тестовая оферта',
  'offer',
  'checkout',
  DATE '2026-01-01',
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'Локальная тестовая оферта для E2E. Не является юридическим документом.',
  '[{"type":"paragraph","text":"Локальная тестовая оферта для E2E."}]'::jsonb,
  false
WHERE NOT EXISTS (
  SELECT 1 FROM legal_document_versions WHERE document_id = 'offer' AND version = '2026-01-01.1'
);

-- Deactivate any prior local-only activation, then activate 2026-01-01.1.
UPDATE legal_document_activations
   SET deactivated_at = now()
 WHERE document_id = 'offer' AND deactivated_at IS NULL;

INSERT INTO legal_document_activations (document_version_id, document_id, version, sha256, activated_at)
SELECT v.id, v.document_id, v.version, v.sha256, now()
  FROM legal_document_versions v
 WHERE v.document_id = 'offer' AND v.version = '2026-01-01.1'
   AND NOT EXISTS (
     SELECT 1 FROM legal_document_activations a
      WHERE a.document_id = 'offer' AND a.version = '2026-01-01.1' AND a.deactivated_at IS NULL
   );
