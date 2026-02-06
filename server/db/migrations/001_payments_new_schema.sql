-- Migration: replace payments table with new schema
-- Run: psql "$DATABASE_URL" -f server/db/migrations/001_payments_new_schema.sql

DROP TABLE IF EXISTS payments;

CREATE TABLE payments (
  id BIGSERIAL PRIMARY KEY,
  telegram_id BIGINT REFERENCES users(telegram_id),
  provider TEXT NOT NULL, -- 'stars' | 'rub'
  plan_id TEXT NOT NULL,  -- 'premium'
  amount INTEGER,
  currency TEXT,
  telegram_payment_charge_id TEXT,
  provider_payment_charge_id TEXT,
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE (provider, telegram_payment_charge_id),
  UNIQUE (provider, provider_payment_charge_id)
);
