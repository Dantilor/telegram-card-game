-- Legal document versions, activation history, consent evidence, and marketing queue.
-- This migration does not contain document bodies. Texts are loaded later by the operator CLI.
-- Existing users, payments, subscriptions, and events are preserved.
-- Nothing here grants consent to current users or activates a document.

CREATE TABLE IF NOT EXISTS legal_document_versions (
  id BIGSERIAL PRIMARY KEY,
  document_id TEXT NOT NULL,
  version TEXT NOT NULL,
  title TEXT NOT NULL,
  kind TEXT NOT NULL,
  scope TEXT NOT NULL,
  document_date DATE,
  sha256 CHAR(64) NOT NULL,
  body_markdown TEXT NOT NULL,
  blocks JSONB NOT NULL,
  requires_individual_details BOOLEAN NOT NULL DEFAULT false,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT legal_document_versions_id_version_unique UNIQUE (document_id, version),
  CONSTRAINT legal_document_versions_sha256_hex CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT legal_document_versions_body_nonempty CHECK (length(body_markdown) > 0),
  CONSTRAINT legal_document_versions_id_nonempty CHECK (length(document_id) > 0)
);

COMMENT ON TABLE legal_document_versions IS
  'Immutable document versions. Full text arrives only through the operator import CLI.';

CREATE OR REPLACE FUNCTION legal_document_versions_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.document_id IS DISTINCT FROM OLD.document_id
     OR NEW.version IS DISTINCT FROM OLD.version
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.kind IS DISTINCT FROM OLD.kind
     OR NEW.scope IS DISTINCT FROM OLD.scope
     OR NEW.document_date IS DISTINCT FROM OLD.document_date
     OR NEW.sha256 IS DISTINCT FROM OLD.sha256
     OR NEW.body_markdown IS DISTINCT FROM OLD.body_markdown
     OR NEW.blocks IS DISTINCT FROM OLD.blocks
     OR NEW.requires_individual_details IS DISTINCT FROM OLD.requires_individual_details
  THEN
    RAISE EXCEPTION 'legal_document_versions are immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS legal_document_versions_no_update ON legal_document_versions;
CREATE TRIGGER legal_document_versions_no_update
  BEFORE UPDATE ON legal_document_versions
  FOR EACH ROW
  EXECUTE PROCEDURE legal_document_versions_immutable();

CREATE OR REPLACE FUNCTION legal_document_versions_no_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'legal_document_versions cannot be deleted';
END;
$$;

DROP TRIGGER IF EXISTS legal_document_versions_no_delete ON legal_document_versions;
CREATE TRIGGER legal_document_versions_no_delete
  BEFORE DELETE ON legal_document_versions
  FOR EACH ROW
  EXECUTE PROCEDURE legal_document_versions_no_delete();

CREATE TABLE IF NOT EXISTS legal_document_activations (
  id BIGSERIAL PRIMARY KEY,
  document_version_id BIGINT NOT NULL REFERENCES legal_document_versions (id),
  document_id TEXT NOT NULL,
  version TEXT NOT NULL,
  sha256 CHAR(64) NOT NULL,
  activated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deactivated_at TIMESTAMPTZ,
  CONSTRAINT legal_document_activations_sha256_hex CHECK (sha256 ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS legal_document_activations_one_active
  ON legal_document_activations (document_id)
  WHERE deactivated_at IS NULL;

CREATE INDEX IF NOT EXISTS legal_document_activations_version_idx
  ON legal_document_activations (document_version_id);

CREATE OR REPLACE FUNCTION legal_document_activations_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.document_version_id IS DISTINCT FROM OLD.document_version_id
     OR NEW.document_id IS DISTINCT FROM OLD.document_id
     OR NEW.version IS DISTINCT FROM OLD.version
     OR NEW.sha256 IS DISTINCT FROM OLD.sha256
     OR NEW.activated_at IS DISTINCT FROM OLD.activated_at
  THEN
    RAISE EXCEPTION 'activation identity is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS legal_document_activations_guard ON legal_document_activations;
CREATE TRIGGER legal_document_activations_guard
  BEFORE UPDATE ON legal_document_activations
  FOR EACH ROW
  EXECUTE PROCEDURE legal_document_activations_guard();

CREATE OR REPLACE FUNCTION legal_refuse_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% cannot be deleted', TG_TABLE_NAME;
END;
$$;

DROP TRIGGER IF EXISTS legal_document_activations_no_delete ON legal_document_activations;
CREATE TRIGGER legal_document_activations_no_delete
  BEFORE DELETE ON legal_document_activations
  FOR EACH ROW
  EXECUTE PROCEDURE legal_refuse_delete();

CREATE TABLE IF NOT EXISTS legal_evidence (
  id BIGSERIAL PRIMARY KEY,
  subject_telegram_id BIGINT NOT NULL REFERENCES users (telegram_id),
  action TEXT NOT NULL,
  document_id TEXT NOT NULL,
  document_version TEXT NOT NULL,
  document_sha256 CHAR(64) NOT NULL,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  confirmation_source TEXT NOT NULL,
  request_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT legal_evidence_request_unique UNIQUE (subject_telegram_id, request_id),
  CONSTRAINT legal_evidence_action_check CHECK (
    action IN ('accept_agreement', 'accept_offer', 'grant', 'withdraw', 'decline')
  ),
  CONSTRAINT legal_evidence_source_check CHECK (confirmation_source = 'telegram_webapp'),
  CONSTRAINT legal_evidence_request_id_check CHECK (char_length(request_id) BETWEEN 8 AND 80),
  CONSTRAINT legal_evidence_sha256_hex CHECK (document_sha256 ~ '^[0-9a-f]{64}$')
);

CREATE INDEX IF NOT EXISTS legal_evidence_subject_doc_created_idx
  ON legal_evidence (subject_telegram_id, document_id, created_at DESC);

CREATE OR REPLACE FUNCTION legal_evidence_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'legal_evidence is append-only';
END;
$$;

DROP TRIGGER IF EXISTS legal_evidence_no_update ON legal_evidence;
CREATE TRIGGER legal_evidence_no_update
  BEFORE UPDATE ON legal_evidence
  FOR EACH ROW
  EXECUTE PROCEDURE legal_evidence_immutable();

DROP TRIGGER IF EXISTS legal_evidence_no_delete ON legal_evidence;
CREATE TRIGGER legal_evidence_no_delete
  BEFORE DELETE ON legal_evidence
  FOR EACH ROW
  EXECUTE PROCEDURE legal_refuse_delete();

CREATE TABLE IF NOT EXISTS legal_preferences (
  subject_telegram_id BIGINT NOT NULL REFERENCES users (telegram_id),
  document_id TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL,
  document_version TEXT NOT NULL,
  document_sha256 CHAR(64) NOT NULL,
  granted_at TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  withdrawn_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence_id BIGINT NOT NULL REFERENCES legal_evidence (id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (subject_telegram_id, document_id, channel),
  CONSTRAINT legal_preferences_state_check CHECK (state IN ('granted', 'withdrawn', 'declined')),
  CONSTRAINT legal_preferences_channel_check CHECK (channel IN ('', 'telegram', 'email')),
  CONSTRAINT legal_preferences_sha256_hex CHECK (document_sha256 ~ '^[0-9a-f]{64}$')
);

CREATE INDEX IF NOT EXISTS legal_preferences_subject_idx
  ON legal_preferences (subject_telegram_id);

CREATE TABLE IF NOT EXISTS marketing_queue (
  id BIGSERIAL PRIMARY KEY,
  subject_telegram_id BIGINT NOT NULL,
  channel TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  CONSTRAINT marketing_queue_channel_check CHECK (channel IN ('telegram', 'email')),
  CONSTRAINT marketing_queue_status_check CHECK (
    status IN ('pending', 'sending', 'sent', 'cancelled', 'failed')
  )
);

CREATE INDEX IF NOT EXISTS marketing_queue_pending_idx
  ON marketing_queue (channel, status, subject_telegram_id);

ALTER TABLE payments ADD COLUMN IF NOT EXISTS offer_evidence_id BIGINT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS receipt_contact TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS receipt_contact_kind TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_offer_evidence_fk'
  ) THEN
    ALTER TABLE payments
      ADD CONSTRAINT payments_offer_evidence_fk
      FOREIGN KEY (offer_evidence_id) REFERENCES legal_evidence (id);
  END IF;
END $$;

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_receipt_contact_kind_check;
ALTER TABLE payments
  ADD CONSTRAINT payments_receipt_contact_kind_check
  CHECK (receipt_contact_kind IS NULL OR receipt_contact_kind IN ('email', 'phone'));

CREATE INDEX IF NOT EXISTS events_created_at_idx ON events (created_at);
