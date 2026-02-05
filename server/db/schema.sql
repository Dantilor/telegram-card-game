-- Run this against your PostgreSQL database before starting the server
-- psql "$DATABASE_URL" -f server/db/schema.sql
-- After schema changes, re-run this file to apply migrations.

CREATE TABLE IF NOT EXISTS users (
  telegram_id BIGINT PRIMARY KEY,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  telegram_id BIGINT REFERENCES users(telegram_id),
  plan_id TEXT NOT NULL,
  active_until TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  PRIMARY KEY (telegram_id, plan_id)
);

CREATE TABLE IF NOT EXISTS payments (
  id BIGSERIAL PRIMARY KEY,
  telegram_id BIGINT NOT NULL REFERENCES users(telegram_id),
  plan_id TEXT NOT NULL,
  currency TEXT NOT NULL,
  total_amount INT NOT NULL,
  provider_payment_charge_id TEXT,
  telegram_payment_charge_id TEXT,
  invoice_payload TEXT,
  status TEXT NOT NULL DEFAULT 'paid',
  created_at TIMESTAMP DEFAULT now()
);

-- Partial unique indexes: prevent duplicate payments by charge_id (when present)
CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_charge_unique
  ON payments (provider_payment_charge_id) WHERE provider_payment_charge_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payments_telegram_charge_unique
  ON payments (telegram_payment_charge_id) WHERE telegram_payment_charge_id IS NOT NULL;

-- When both charge_ids are null, dedup is done in application (savePaymentDb).
