-- Additive: receipt email on WEB payments + pending email on accounts for magic-link confirm.
-- Does not alter Telegram tables. Safe to re-run (IF NOT EXISTS).

ALTER TABLE web_payments
  ADD COLUMN IF NOT EXISTS receipt_email_normalized TEXT;

ALTER TABLE web_accounts
  ADD COLUMN IF NOT EXISTS pending_email_normalized TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'web_payments_receipt_email_len'
  ) THEN
    ALTER TABLE web_payments
      ADD CONSTRAINT web_payments_receipt_email_len CHECK (
        receipt_email_normalized IS NULL
        OR (char_length(receipt_email_normalized) BETWEEN 3 AND 320)
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'web_accounts_pending_email_len'
  ) THEN
    ALTER TABLE web_accounts
      ADD CONSTRAINT web_accounts_pending_email_len CHECK (
        pending_email_normalized IS NULL
        OR (char_length(pending_email_normalized) BETWEEN 3 AND 320)
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS web_payments_receipt_email_idx
  ON web_payments (receipt_email_normalized)
  WHERE receipt_email_normalized IS NOT NULL AND premium_granted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS web_accounts_pending_email_idx
  ON web_accounts (pending_email_normalized)
  WHERE pending_email_normalized IS NOT NULL AND revoked_at IS NULL;

COMMENT ON COLUMN web_payments.receipt_email_normalized IS
  'Checkout receipt email. Not ownership proof until magic-link verified.';

COMMENT ON COLUMN web_accounts.pending_email_normalized IS
  'Email awaiting magic-link confirmation. Not treated as verified contact.';
