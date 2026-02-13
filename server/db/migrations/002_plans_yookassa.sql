-- Plans table for YooKassa payments
CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  price_rub INTEGER NOT NULL,
  duration_days INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now()
);

INSERT INTO plans (id, title, price_rub, duration_days, is_active)
VALUES ('premium_3m', 'Premium 3 месяца', 259, 90, true)
ON CONFLICT (id) DO NOTHING;

-- Add provider, invoice_payload, status to payments if not exist
ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'yookassa';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS invoice_payload TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS total_amount INTEGER;
