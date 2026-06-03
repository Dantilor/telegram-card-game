-- Idempotency for YooKassa premium grants: one paymentId -> one subscription extension.
-- Run: psql "$DATABASE_URL" -f server/db/migrations/004_payments_premium_granted_at.sql

ALTER TABLE payments ADD COLUMN IF NOT EXISTS premium_granted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS payments_premium_granted_at_idx
  ON payments (premium_granted_at)
  WHERE premium_granted_at IS NOT NULL;
