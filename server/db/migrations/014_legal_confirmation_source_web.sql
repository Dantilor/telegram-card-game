-- Additive: allow WEB Telegram Login evidence source alongside Mini App.
-- Does not rewrite documents or touch existing evidence rows.
-- Safe to apply only after review; not applied to production by Stage 2C.

ALTER TABLE legal_evidence
  DROP CONSTRAINT IF EXISTS legal_evidence_source_check;

ALTER TABLE legal_evidence
  ADD CONSTRAINT legal_evidence_source_check
  CHECK (confirmation_source IN ('telegram_webapp', 'telegram_login_web'));
