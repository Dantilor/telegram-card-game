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
  telegram_id BIGINT REFERENCES users(telegram_id),
  provider TEXT NOT NULL, -- 'stars' | 'rub'
  plan_id TEXT NOT NULL,  -- 'premium'
  amount INTEGER,
  currency TEXT,
  telegram_payment_charge_id TEXT,
  provider_payment_charge_id TEXT,
  premium_granted_at TIMESTAMPTZ,
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE (provider, telegram_payment_charge_id),
  UNIQUE (provider, provider_payment_charge_id)
);

-- Events analytics
CREATE TABLE IF NOT EXISTS events (
  id BIGSERIAL PRIMARY KEY,
  telegram_id BIGINT NULL,
  event_name TEXT NOT NULL,
  event_props JSONB NULL,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS events_event_name_created_at ON events (event_name, created_at);
CREATE INDEX IF NOT EXISTS events_telegram_id_created_at ON events (telegram_id, created_at) WHERE telegram_id IS NOT NULL;
