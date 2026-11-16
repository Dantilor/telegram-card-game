-- Anonymous WEB legal subjects (parallel to telegram legal_evidence / legal_preferences).
-- Does not alter Telegram Mini App legal tables or confirmation_source checks on those tables.

CREATE TABLE IF NOT EXISTS web_legal_evidence (
  id BIGSERIAL PRIMARY KEY,
  subject_web_account_id UUID NOT NULL REFERENCES web_accounts (id),
  action TEXT NOT NULL,
  document_id TEXT NOT NULL,
  document_version TEXT NOT NULL,
  document_sha256 TEXT NOT NULL,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  request_id TEXT NOT NULL,
  confirmation_source TEXT NOT NULL DEFAULT 'web_account',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT web_legal_evidence_request_unique UNIQUE (subject_web_account_id, request_id),
  CONSTRAINT web_legal_evidence_source_chk CHECK (confirmation_source = 'web_account')
);

CREATE INDEX IF NOT EXISTS web_legal_evidence_subject_doc_idx
  ON web_legal_evidence (subject_web_account_id, document_id, created_at DESC);

CREATE TABLE IF NOT EXISTS web_legal_preferences (
  subject_web_account_id UUID NOT NULL REFERENCES web_accounts (id),
  document_id TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL,
  document_version TEXT NOT NULL,
  document_sha256 TEXT NOT NULL,
  granted_at TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  withdrawn_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  evidence_id BIGINT REFERENCES web_legal_evidence (id),
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (subject_web_account_id, document_id, channel),
  CONSTRAINT web_legal_preferences_state_chk CHECK (state IN ('granted', 'declined', 'withdrawn'))
);

CREATE INDEX IF NOT EXISTS web_legal_preferences_subject_idx
  ON web_legal_preferences (subject_web_account_id);

COMMENT ON TABLE web_legal_evidence IS
  'WEB anonymous account legal evidence (agreement / offer). Separate from Telegram legal_evidence.';
COMMENT ON TABLE web_legal_preferences IS
  'WEB anonymous account legal preferences. Separate from Telegram legal_preferences.';
