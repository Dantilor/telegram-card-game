-- Run this against your PostgreSQL database before starting the server
-- psql $DATABASE_URL -f db/schema.sql

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
